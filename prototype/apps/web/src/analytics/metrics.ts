/**
 * Dashboard metrics for organisers (FR 67) and venue operators (FR 68, FR 69).
 * In the real system these are the SQL views v_organiser_dashboard,
 * v_venue_dashboard and v_event_sales_daily (docs/erd.md).
 */
import { DEMO_NOW, dublinDateKey } from "../domain/format";
import type { HistBooking, HistEvent, History } from "./history";
import { HISTORY_START } from "./history";
import { mean, sum } from "./stats";

export type PeriodId = "3m" | "6m" | "ytd";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "ytd", label: "2026 so far" },
];

export interface Period {
  id: PeriodId;
  label: string;
  start: string; // inclusive YYYY-MM-DD
  end: string; // inclusive
  previous?: { start: string; end: string; label: string };
}

const addDays = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const addMonths = (key: string, months: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

export function getPeriod(id: PeriodId): Period {
  const end = dublinDateKey(new Date(DEMO_NOW.getTime() - 86400_000));
  const label = PERIODS.find((p) => p.id === id)!.label;
  if (id === "ytd") return { id, label, start: HISTORY_START, end };
  const months = id === "3m" ? 3 : 6;
  const start = addDays(addMonths(end, -months), 1);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(addMonths(prevEnd, -months), 1);
  return {
    id,
    label,
    start,
    end,
    previous:
      prevStart >= HISTORY_START
        ? { start: prevStart, end: prevEnd, label: `previous ${months} months` }
        : undefined,
  };
}

export const inRange = (date: string, start: string, end: string) => date >= start && date <= end;

/* ------------------------------------------------------------------ Organiser */

export interface OrganiserKpis {
  events: number;
  sold: number;
  revenueCents: number;
  sellThrough: number; // 0–1
  attendance: number; // checked in ÷ sold
}

export function organiserKpis(events: HistEvent[]): OrganiserKpis {
  const sold = sum(events.map((e) => e.sold));
  const capacity = sum(events.map((e) => e.capacity));
  return {
    events: events.length,
    sold,
    revenueCents: sum(events.map((e) => e.ticketRevenueCents)),
    sellThrough: capacity ? sold / capacity : 0,
    attendance: sold ? sum(events.map((e) => e.checkedIn)) / sold : 0,
  };
}

/** Monday of the ISO week containing the date. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export interface SalesCurve {
  date: string; // event date
  cumulative: number[]; // index = days before the event
  firstDay: number; // smallest index with data (0 for past events, days-out for upcoming)
}

/** Tickets sold per week by purchase date, for weeks inside the period. */
export function weeklySales(curves: SalesCurve[], start: string, end: string): { week: string; value: number }[] {
  const weeks = new Map<string, number>();
  for (let w = weekStart(start); w <= end; w = addDays(w, 7)) weeks.set(w, 0);
  for (const c of curves) {
    const lead = c.cumulative.length - 1;
    for (let d = lead; d >= c.firstDay; d--) {
      const sold = c.cumulative[d] - (d + 1 <= lead ? c.cumulative[d + 1] : 0);
      if (!sold) continue;
      const date = addDays(c.date, -d);
      if (!inRange(date, start, end)) continue;
      const w = weekStart(date);
      if (weeks.has(w)) weeks.set(w, weeks.get(w)! + sold);
    }
  }
  return [...weeks].map(([week, value]) => ({ week, value }));
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let m = `${start.slice(0, 7)}-01`;
  while (m.slice(0, 7) <= end.slice(0, 7)) {
    out.push(m.slice(0, 7));
    m = addMonths(m, 1);
  }
  return out;
}

export function monthlyRevenue(events: HistEvent[], start: string, end: string) {
  return monthsBetween(start, end).map((month) => ({
    month,
    value: sum(events.filter((e) => monthKey(e.date) === month).map((e) => e.ticketRevenueCents)),
  }));
}

export function ticketTypeSellThrough(events: HistEvent[]) {
  const byName = new Map<string, { sold: number; total: number; revenueCents: number }>();
  for (const e of events)
    for (const t of e.ticketTypes) {
      const cur = byName.get(t.name) ?? { sold: 0, total: 0, revenueCents: 0 };
      cur.sold += t.sold;
      cur.total += t.total;
      cur.revenueCents += t.sold * t.priceCents;
      byName.set(t.name, cur);
    }
  return [...byName].map(([name, v]) => ({ name, ...v, rate: v.total ? v.sold / v.total : 0 }));
}

/* ------------------------------------------------------------------ Venue */

export interface VenueKpis {
  bookings: number;
  occupancy: number; // booked venue-evenings ÷ open venue-evenings
  bookingRevenueCents: number;
  barRevenueCents: number;
  barPerAttendeeCents: number;
  attendees: number;
}

export function venueKpis(
  bookings: HistBooking[],
  events: HistEvent[],
  openDates: string[],
  venueCount: number,
): VenueKpis {
  const attendees = sum(events.map((e) => e.checkedIn));
  const eventBar = sum(events.map((e) => e.barRevenueCents));
  return {
    bookings: bookings.length,
    occupancy: openDates.length ? bookings.length / (openDates.length * venueCount) : 0,
    bookingRevenueCents: sum(bookings.map((b) => b.revenueCents)),
    barRevenueCents: sum(bookings.map((b) => b.barRevenueCents)),
    barPerAttendeeCents: attendees ? eventBar / attendees : 0,
    attendees,
  };
}

export function monthlyOccupancy(
  bookings: HistBooking[],
  openDates: string[],
  venueCount: number,
  start: string,
  end: string,
) {
  return monthsBetween(start, end).map((month) => {
    const open = openDates.filter((d) => monthKey(d) === month && inRange(d, start, end)).length * venueCount;
    const booked = bookings.filter((b) => monthKey(b.date) === month).length;
    return { month, value: open ? booked / open : 0, booked, open };
  });
}

/** Mean bar takings per 15-minute interval from doors, across events with bar data (FR 69). */
export function barByInterval(events: HistEvent[], maxIntervals = 16) {
  const withBar = events.filter((e) => e.bar15.length);
  const longest = Math.min(maxIntervals, Math.max(0, ...withBar.map((e) => e.bar15.length)));
  return Array.from({ length: longest }, (_, i) => {
    const vals = withBar.filter((e) => e.bar15.length > i).map((e) => e.bar15[i]);
    return { interval: i, value: vals.length ? mean(vals) : 0, n: vals.length };
  });
}

export const barPerAttendee = (e: HistEvent) => (e.checkedIn ? e.barRevenueCents / e.checkedIn : 0);

export function scopeHistory(history: History, opts: { start: string; end: string; venueIds?: string[]; organiserId?: string }) {
  const okVenue = (id: string) => !opts.venueIds || opts.venueIds.includes(id);
  return {
    events: history.events.filter(
      (e) =>
        inRange(e.date, opts.start, opts.end) &&
        okVenue(e.venueId) &&
        (!opts.organiserId || e.organiserId === opts.organiserId),
    ),
    bookings: history.bookings.filter((b) => inRange(b.date, opts.start, opts.end) && okVenue(b.venueId)),
    openDates: history.openDates.filter((d) => inRange(d, opts.start, opts.end)),
  };
}
