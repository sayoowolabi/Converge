/**
 * Plain-language insights (FR 71), built the way docs/ml-design.md specifies:
 * statistical detection (segment comparisons, peaks, forecast flags) plus
 * template-based text (Reiter & Dale 2000). No external LLM (WN 5, NFR 12).
 *
 * Rules that keep claims honest:
 *  - every number in a sentence comes from the computation shown in `evidence`;
 *  - a comparison needs at least MIN_GROUP events in each group (FR 71);
 *  - a comparison is only reported if its Bonferroni-adjusted bootstrap
 *    interval excludes zero, across all comparisons tested by that detector;
 *  - insights are ranked by the conservative end of that interval (effect size
 *    × confidence) and only the top few are shown.
 */
import { formatMoney } from "../domain/format";
import type { Forecast } from "./forecast";
import { PRICE_BAND_LABEL, priceBand, type HistBooking, type HistEvent, type PriceBand } from "./history";
import { barByInterval, barPerAttendee } from "./metrics";
import { compareMeans, hashSeed, mean, type Comparison } from "./stats";

export const MIN_GROUP = 8;
export const MAX_INSIGHTS = 5;

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Insight {
  id: string;
  kind: "segment" | "category" | "lead" | "peak" | "occupancy" | "forecast";
  text: string;
  score: number;
  method: string;
  evidence: { label: string; value: string }[];
  note?: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const signedPct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x * 100))}%`;
const signedPts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(Math.round(x))} pts`;
const sellThrough = (e: HistEvent) => e.sold / e.capacity;
const noShowRate = (e: HistEvent) => (e.sold ? 1 - e.checkedIn / e.sold : 0);

interface Candidate {
  a: string;
  b: string;
  within?: PriceBand;
  xs: number[];
  ys: number[];
}

/** Run all pairwise comparisons in `candidates`; keep the significant one with the largest conservative effect. */
function bestComparison(
  family: string,
  candidates: Candidate[],
  kind: "ratio" | "points",
): (Candidate & { c: Comparison; tested: number }) | undefined {
  const tested = candidates.length;
  let best: (Candidate & { c: Comparison; tested: number }) | undefined;
  for (const cand of candidates) {
    const c = compareMeans(cand.xs, cand.ys, kind, hashSeed(`${family}|${cand.a}|${cand.b}|${cand.within ?? ""}|${cand.xs.length}|${cand.ys.length}`), tested);
    if (c.loAdj > 0 && (!best || c.loAdj > best.c.loAdj)) best = { ...cand, c, tested };
  }
  return best;
}

/** Ordered pairs (higher mean first) of groups with enough events. */
function pairs(groups: Map<string, number[]>, within?: PriceBand): Candidate[] {
  const keys = [...groups.keys()].filter((k) => groups.get(k)!.length >= MIN_GROUP);
  const out: Candidate[] = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const [a, b] = mean(groups.get(keys[i])!) >= mean(groups.get(keys[j])!) ? [keys[i], keys[j]] : [keys[j], keys[i]];
      out.push({ a, b, within, xs: groups.get(a)!, ys: groups.get(b)! });
    }
  return out;
}

function groupBy(events: HistEvent[], key: (e: HistEvent) => string, value: (e: HistEvent) => number) {
  const m = new Map<string, number[]>();
  for (const e of events) {
    const k = key(e);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(value(e));
  }
  return m;
}

const ciText = (c: Comparison, kind: "ratio" | "points") =>
  kind === "ratio" ? `${signedPct(c.lo)} to ${signedPct(c.hi)}` : `${signedPts(c.lo)} to ${signedPts(c.hi)}`;

const methodNote = (tested: number) =>
  `Bootstrap comparison of means (2,000 resamples, fixed seed). Groups need at least ${MIN_GROUP} events. ${tested} comparison${
    tested === 1 ? " was" : "s were"
  } tested, so this is only shown because its Bonferroni-adjusted interval stays above zero.`;

/* ------------------------------------------------------------------ Detectors */

/**
 * Weekday × price band comparison of a per-event metric. Each night is compared
 * with the busiest night in scope (the "reference night" operators benchmark
 * against), within the same ticket-price band, so "comparable" means same band.
 */
function weekdayByPrice(
  events: HistEvent[],
  metric: { id: string; value: (e: HistEvent) => number; phrase: string; format: (v: number) => string },
): Insight | undefined {
  if (!events.length) return;
  const counts = new Map<number, number>();
  for (const e of events) counts.set(e.weekday, (counts.get(e.weekday) ?? 0) + 1);
  const reference = [...counts].sort((x, y) => y[1] - x[1])[0][0];
  const bands = new Map<PriceBand, HistEvent[]>();
  for (const e of events) {
    const b = priceBand(e.priceCents);
    if (!bands.has(b)) bands.set(b, []);
    bands.get(b)!.push(e);
  }
  const candidates: Candidate[] = [];
  for (const [band, evs] of bands) {
    const ref = evs.filter((e) => e.weekday === reference).map(metric.value);
    if (ref.length < MIN_GROUP) continue;
    for (let wd = 0; wd < 7; wd++) {
      if (wd === reference) continue;
      const xs = evs.filter((e) => e.weekday === wd).map(metric.value);
      if (xs.length >= MIN_GROUP) candidates.push({ a: DAY[wd], b: DAY[reference], within: band, xs, ys: ref });
    }
  }
  const best = bestComparison(`weekday-band-${metric.id}`, candidates, "ratio");
  if (!best) return;
  const { a, b, within, c, tested } = best;
  return {
    id: `segment-${metric.id}-${a}-${b}-${within}`,
    kind: "segment",
    text: `Events held on ${a}s with ticket prices ${PRICE_BAND_LABEL[within!]} generated ${Math.round(
      c.effect * 100,
    )}% higher ${metric.phrase} than comparable ${b} events.`,
    score: c.loAdj,
    method: `Segment comparison: each night vs your busiest night (${b}), within the same ticket-price band`,
    evidence: [
      { label: `${a}, ${PRICE_BAND_LABEL[within!]}`, value: `${metric.format(c.meanA)} per attendee · ${c.nA} events` },
      { label: `${b}, ${PRICE_BAND_LABEL[within!]}`, value: `${metric.format(c.meanB)} per attendee · ${c.nB} events` },
      { label: "Difference", value: `${signedPct(c.effect)} (95% CI ${ciText(c, "ratio")})` },
    ],
    note: `${methodNote(tested)} "Comparable" means the same ticket-price band; differences in event category between nights aren't controlled for.`,
  };
}

/** Weekday comparison of a rate (sell-through, no-shows), in percentage points. */
function weekdayRate(
  events: HistEvent[],
  metric: { id: string; value: (e: HistEvent) => number; lowerIsBetter?: boolean; render: (better: string, worse: string, pts: number) => string },
): Insight | undefined {
  // pairs() orders each pair so group "a" has the higher mean.
  const best = bestComparison(`weekday-${metric.id}`, pairs(groupBy(events, (e) => DAY[e.weekday], metric.value)), "points");
  if (!best) return;
  const { a, b, c, tested } = best;
  const hi = { day: a, mean: c.meanA, n: c.nA };
  const lo = { day: b, mean: c.meanB, n: c.nB };
  const [better, worse] = metric.lowerIsBetter ? [lo, hi] : [hi, lo];
  return {
    id: `rate-${metric.id}-${better.day}-${worse.day}`,
    kind: "segment",
    text: metric.render(better.day, worse.day, Math.round(c.effect)),
    score: c.loAdj / 100 / Math.max(0.05, lo.mean),
    method: "Segment comparison: weekday",
    evidence: [
      { label: `${better.day} events`, value: `${pct(better.mean)} · ${better.n} events` },
      { label: `${worse.day} events`, value: `${pct(worse.mean)} · ${worse.n} events` },
      { label: "Difference", value: `${Math.round(c.effect)} pts ${metric.lowerIsBetter ? "fewer" : "more"} (95% CI ${Math.round(c.lo)} to ${Math.round(c.hi)} pts)` },
    ],
    note: methodNote(tested),
  };
}

function bestCategory(events: HistEvent[], subject: string): Insight | undefined {
  const cats = [...new Set(events.map((e) => e.category))];
  const candidates: Candidate[] = cats
    .map((cat) => ({
      a: cat,
      b: "other",
      xs: events.filter((e) => e.category === cat).map(sellThrough),
      ys: events.filter((e) => e.category !== cat).map(sellThrough),
    }))
    .filter((c) => c.xs.length >= MIN_GROUP && c.ys.length >= MIN_GROUP && mean(c.xs) > mean(c.ys));
  const best = bestComparison("category-sell", candidates, "points");
  if (!best) return;
  const { a, c, tested } = best;
  return {
    id: `category-${a}`,
    kind: "category",
    text: `${a} events sold ${pct(c.meanA)} of their tickets, ${Math.round(c.effect)} points above ${subject} other events.`,
    score: c.loAdj / 100 / Math.max(0.05, c.meanB),
    method: "Segment comparison: category vs the rest",
    evidence: [
      { label: `${a}`, value: `${pct(c.meanA)} sell-through · ${c.nA} events` },
      { label: "All other categories", value: `${pct(c.meanB)} sell-through · ${c.nB} events` },
      { label: "Difference", value: `${signedPts(c.effect)} (95% CI ${ciText(c, "points")})` },
    ],
    note: methodNote(tested),
  };
}

function leadTime(events: HistEvent[]): Insight | undefined {
  const long = events.filter((e) => e.leadDays >= 28).map(sellThrough);
  const short = events.filter((e) => e.leadDays < 28).map(sellThrough);
  if (long.length < MIN_GROUP || short.length < MIN_GROUP) return;
  const best = bestComparison("lead", [{ a: "4+ weeks", b: "under 4 weeks", xs: long, ys: short }], "points");
  if (!best) return;
  const { c, tested } = best;
  return {
    id: "lead-time",
    kind: "lead",
    text: `Events on sale for 4 weeks or more sold ${Math.round(c.effect)} points more of their capacity than events announced later. Announce earlier where you can.`,
    score: c.loAdj / 100 / Math.max(0.05, c.meanB),
    method: "Segment comparison: days on sale",
    evidence: [
      { label: "On sale 4+ weeks", value: `${pct(c.meanA)} sell-through · ${c.nA} events` },
      { label: "On sale under 4 weeks", value: `${pct(c.meanB)} sell-through · ${c.nB} events` },
      { label: "Difference", value: `${signedPts(c.effect)} (95% CI ${ciText(c, "points")})` },
    ],
    note: methodNote(tested),
  };
}

function barPeak(events: HistEvent[]): Insight | undefined {
  const profile = barByInterval(events);
  const n = Math.min(...profile.map((p) => p.n));
  if (!profile.length || n < MIN_GROUP) return;
  const avg = mean(profile.map((p) => p.value));
  const peak = profile.reduce((m, p) => (p.value > m.value ? p : m), profile[0]);
  const lift = peak.value / avg - 1;
  const from = peak.interval * 15;
  return {
    id: "bar-peak",
    kind: "peak",
    text: `Bar sales peak ${from}–${from + 15} minutes after doors, ${Math.round(lift * 100)}% above an average 15 minutes. Have full bar staff on before then.`,
    score: Math.min(0.5, lift / 4),
    method: "Peak detection on 15-minute bar-sales intervals (FR 69)",
    evidence: [
      { label: "Peak interval", value: `${from}–${from + 15} min after doors · ${formatMoney(Math.round(peak.value))} on average` },
      { label: "Average interval", value: formatMoney(Math.round(avg)) },
      { label: "Events with bar data", value: `${profile[0].n}` },
    ],
    note: "Mean takings per 15-minute interval from doors, across events in the selected period and venues.",
  };
}

function occupancyGap(bookings: HistBooking[], openDates: string[], venueCount: number): Insight | undefined {
  const rates = [0, 2, 3, 4, 5, 6].map((wd) => {
    const open = openDates.filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === wd).length * venueCount;
    const booked = bookings.filter((b) => b.weekday === wd).length;
    return { wd, open, rate: open ? booked / open : 0 };
  });
  if (rates.some((r) => r.open < MIN_GROUP)) return;
  const hi = rates.reduce((m, r) => (r.rate > m.rate ? r : m));
  const lo = rates.reduce((m, r) => (r.rate < m.rate ? r : m));
  if (hi.rate - lo.rate < 0.2) return;
  return {
    id: "occupancy-gap",
    kind: "occupancy",
    text: `${DAY[hi.wd]}s were booked ${pct(hi.rate)} of the time, but ${DAY[lo.wd]}s only ${pct(lo.rate)}. Midweek is where you have room to grow, for example with a cheaper weeknight package.`,
    score: (hi.rate - lo.rate) / 2,
    method: "Occupancy by weekday",
    evidence: rates.map((r) => ({ label: DAY[r.wd], value: `${pct(r.rate)} of ${r.open} open evenings` })),
    note: "Booked evenings ÷ open evenings (Tuesday to Sunday) for the selected venues and period.",
  };
}

function forecastFlags(forecasts: Forecast[]): Insight[] {
  return forecasts
    .filter((f) => f.status === "below")
    .map((f) => {
      const short = 1 - f.event.sold / f.expectedNow;
      return {
        id: `forecast-${f.event.id}`,
        kind: "forecast" as const,
        text: `${f.event.title} is tracking ${Math.round(short * 100)}% below similar events at this point: ${f.event.sold} sold with ${f.event.daysOut} days to go, where similar events had about ${Math.round(f.expectedNow)}.`,
        score: Math.min(1, short),
        method: "Sales-pace baseline (FR 70)",
        evidence: [
          { label: "Sold so far", value: `${f.event.sold} of ${f.event.capacity}` },
          { label: `Similar events at ${f.event.daysOut} days out`, value: `about ${Math.round(f.expectedNow)} (median)` },
          { label: "Projected final", value: `${f.projected} (likely ${f.low}–${f.high})` },
          { label: "Compared with", value: `${f.similar.length} ${f.similarRule}` },
        ],
        note: "Pace baseline: median share of final sales that similar past events had reached at the same number of days out.",
      };
    });
}

/* ------------------------------------------------------------------ Public API */

const rank = (xs: (Insight | undefined)[]) =>
  xs.filter((x): x is Insight => !!x).sort((a, b) => b.score - a.score).slice(0, MAX_INSIGHTS);

export function organiserInsights(events: HistEvent[], forecasts: Forecast[]): Insight[] {
  return rank([
    ...forecastFlags(forecasts),
    weekdayRate(events, {
      id: "sell",
      value: sellThrough,
      render: (a, b, pts) => `Your ${a} events sold ${pts} points more of their capacity than your ${b} events.`,
    }),
    weekdayRate(events, {
      id: "noshow",
      value: noShowRate,
      lowerIsBetter: true,
      render: (a, b, pts) => `${a} events had ${pts} points fewer no-shows than ${b} events.`,
    }),
    bestCategory(events, "your"),
    leadTime(events),
  ]);
}

export function venueInsights(events: HistEvent[], bookings: HistBooking[], openDates: string[], venueCount: number): Insight[] {
  return rank([
    weekdayByPrice(events, {
      id: "bar",
      value: barPerAttendee,
      phrase: "bar revenue per attendee",
      format: (v) => formatMoney(Math.round(v), { exact: true }),
    }),
    barPeak(events),
    occupancyGap(bookings, openDates, venueCount),
    bestCategory(events, "the"),
  ]);
}
