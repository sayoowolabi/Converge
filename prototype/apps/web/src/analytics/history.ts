/**
 * Synthetic, seeded event history for the analytics dashboards (DECISIONS D-045).
 *
 * There is no real activity before submission, so, as ml-design.md plans
 * ("Data: synthetic generation"), ~10 months of past events are generated at
 * the three fictional venues. A few patterns are planted so the insight
 * detectors have something true to find; the detectors are never told about
 * them and must rediscover them statistically:
 *   - Thursday events priced €10–€15 have ~24% higher bar spend per head than
 *     comparable Friday events (the project brief's example).
 *   - Friday is the busiest night; Saturdays sell best; events on sale 4+ weeks
 *     sell more of their capacity.
 *   - Sunday events have fewer no-shows; Friday events more.
 *   - Bar sales peak 45–75 minutes after doors.
 * Same seed → same data on every run.
 */
import { DEMO_NOW, dublinDateKey, dublinToIso } from "../domain/format";
import type { Category } from "../domain/types";
import { clamp, mulberry32, normal, pick } from "./stats";

export const HISTORY_SEED = 20261118;
export const HISTORY_START = "2026-01-06";

export type PriceBand = "under10" | "10to15" | "16to25" | "over25";

export const PRICE_BAND_LABEL: Record<PriceBand, string> = {
  under10: "under €10",
  "10to15": "between €10 and €15",
  "16to25": "between €16 and €25",
  over25: "over €25",
};

export function priceBand(cents: number): PriceBand {
  if (cents < 1000) return "under10";
  if (cents <= 1500) return "10to15";
  if (cents <= 2500) return "16to25";
  return "over25";
}

export interface HistTicketType {
  name: string;
  priceCents: number;
  total: number;
  sold: number;
}

export interface HistEvent {
  id: string;
  title: string;
  organiserId: string;
  organiserName: string;
  venueId: string;
  category: Category;
  weekday: number; // 0 = Sunday (Europe/Dublin)
  date: string; // YYYY-MM-DD
  startsAt: string;
  durationMin: number;
  priceCents: number; // headline (Standard / General admission) price
  capacity: number;
  leadDays: number; // days on sale before the event
  /** cumulative[d] = tickets sold by the end of the day d days before the event; cumulative[0] = final. */
  cumulative: number[];
  sold: number;
  checkedIn: number;
  ticketRevenueCents: number;
  /** Bar takings by 15-minute interval from doors (FR 69); empty where the venue has no bar. */
  bar15: number[];
  barRevenueCents: number;
  bookingRevenueCents: number;
  ticketTypes: HistTicketType[];
}

export interface HistBooking {
  id: string;
  venueId: string;
  date: string;
  weekday: number;
  kind: "event" | "private";
  revenueCents: number;
  barRevenueCents: number;
  eventId?: string;
}

export interface History {
  events: HistEvent[];
  bookings: HistBooking[];
  /** Open evenings per venue per date key (Tue–Sun), for occupancy (FR 68). */
  openDates: string[];
}

export const HISTORY_ORGANISERS: Record<string, string> = {
  "u-aoife": "Liberties Supper Society",
  "u-ciaran": "Dublin Sketch Club",
  "u-niamh": "Dublin Board Gamers",
  "o-tablefolk": "Tablefolk Dinners",
  "o-canalbooks": "Canal Book Club",
  "o-gcc": "Grand Canal Comedy",
  "o-quietroom": "Quiet Room Sessions",
};

interface VenueProfile {
  nightProb: Record<number, number>;
  categories: [Category, number][];
  standing: number;
  seated: number;
  spendCents: number;
  roomFeeCents: number;
}

const VENUES: Record<string, VenueProfile> = {
  "v-lockkeeper": {
    nightProb: { 0: 0.4, 1: 0, 2: 0.22, 3: 0.32, 4: 0.72, 5: 0.86, 6: 0.8 },
    categories: [
      ["Food & drink", 0.45],
      ["Community", 0.25],
      ["Comedy", 0.15],
      ["Live music", 0.15],
    ],
    standing: 120,
    seated: 70,
    spendCents: 1300,
    roomFeeCents: 45000,
  },
  "v-forge": {
    nightProb: { 0: 0.3, 1: 0, 2: 0.12, 3: 0.2, 4: 0.5, 5: 0.66, 6: 0.6 },
    categories: [
      ["Arts & culture", 0.35],
      ["Live music", 0.35],
      ["Community", 0.3],
    ],
    standing: 220,
    seated: 120,
    spendCents: 1100,
    roomFeeCents: 60000,
  },
  "v-loft": {
    nightProb: { 0: 0.25, 1: 0, 2: 0.2, 3: 0.3, 4: 0.6, 5: 0.74, 6: 0.68 },
    categories: [
      ["Comedy", 0.45],
      ["Live music", 0.35],
      ["Community", 0.2],
    ],
    standing: 80,
    seated: 50,
    spendCents: 1500,
    roomFeeCents: 30000,
  },
};

const ORGANISER_FOR: Record<Category, [string, number][]> = {
  "Food & drink": [
    ["u-aoife", 0.7],
    ["o-tablefolk", 0.3],
  ],
  Community: [
    ["u-aoife", 0.3],
    ["u-niamh", 0.4],
    ["o-canalbooks", 0.3],
  ],
  Comedy: [["o-gcc", 1]],
  "Live music": [["o-quietroom", 1]],
  "Arts & culture": [["u-ciaran", 1]],
  "Trad & folk": [["o-quietroom", 1]],
};

const PRICES: Record<Category, [number, number][]> = {
  "Food & drink": [
    [1200, 2],
    [1400, 3],
    [1500, 2],
    [1800, 2],
    [2200, 2],
    [2800, 1],
    [3200, 1],
  ],
  Comedy: [
    [800, 2],
    [1000, 3],
    [1200, 3],
    [1500, 2],
  ],
  "Live music": [
    [1000, 2],
    [1200, 3],
    [1400, 2],
    [1500, 2],
    [1800, 2],
    [2000, 1],
  ],
  Community: [
    [500, 2],
    [800, 2],
    [1000, 3],
    [1200, 2],
  ],
  "Arts & culture": [
    [1000, 2],
    [1200, 3],
    [1500, 2],
    [1800, 1],
  ],
  "Trad & folk": [[1500, 1]],
};

const TITLES: Record<Category, string[]> = {
  "Food & drink": ["Supper Club", "Long Table", "Market Dinner", "Harvest Supper", "Sunday Roast Social"],
  Community: ["Board Games Night", "Book Club Social", "Language Exchange", "Quiz Night"],
  Comedy: ["Comedy Upstairs", "New Material Night", "Canal Comedy"],
  "Live music": ["Songwriters' Circle", "Late Jazz", "Quiet Room Session"],
  "Arts & culture": ["Life Drawing", "Print Studio Night", "Sketch Social"],
  "Trad & folk": ["Session"],
};

const WEEKDAY_SELL: Record<number, number> = { 0: 0.66, 1: 0.5, 2: 0.55, 3: 0.62, 4: 0.72, 5: 0.8, 6: 0.86 };
const CATEGORY_SELL: Partial<Record<Category, number>> = {
  "Food & drink": 0.1,
  Comedy: 0.05,
  Community: -0.05,
};
const MONTH_SELL: Record<number, number> = { 0: -0.07, 1: -0.04, 6: -0.03, 7: -0.03, 9: 0.03, 10: 0.03 };
const WEEKDAY_SPEND: Record<number, number> = { 0: 0.9, 1: 0.9, 2: 0.95, 3: 1, 4: 1, 5: 1, 6: 1.08 };
const CATEGORY_SPEND: Partial<Record<Category, number>> = {
  "Food & drink": 0.85,
  Comedy: 1.1,
  "Live music": 1.15,
  Community: 0.8,
  "Arts & culture": 0.9,
};

function salesCurve(rand: () => number, sold: number, lead: number): number[] {
  const early = 0.15 + rand() * 0.15;
  const k = 2 + rand() * 1.2;
  const cumulative: number[] = [];
  for (let d = 0; d <= lead; d++) {
    const x = 1 - d / lead;
    cumulative[d] = Math.round(sold * (early * Math.sqrt(x) + (1 - early) * x ** k));
  }
  cumulative[0] = sold;
  for (let d = lead - 1; d >= 0; d--) cumulative[d] = Math.max(cumulative[d], cumulative[d + 1]);
  return cumulative;
}

function barProfile(rand: () => number, intervals: number, total: number): number[] {
  const weights = Array.from({ length: intervals }, (_, i) => {
    const t = i + 0.5;
    return Math.max(0.02, (t * t * Math.exp(-t / 1.7) + 0.18) * (1 + normal(rand, 0, 0.12)));
  });
  const w = weights.reduce((n, x) => n + x, 0);
  return weights.map((x) => Math.round((total * x) / w));
}

function generate(): History {
  const rand = mulberry32(HISTORY_SEED);
  const events: HistEvent[] = [];
  const bookings: HistBooking[] = [];
  const openDates: string[] = [];
  const end = dublinDateKey(new Date(DEMO_NOW.getTime() - 86400_000));
  const day = new Date(`${HISTORY_START}T12:00:00Z`);
  let n = 0;

  while (dublinDateKey(day) <= end) {
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    const month = day.getUTCMonth();
    if (weekday !== 1) openDates.push(date);

    for (const [venueId, v] of Object.entries(VENUES)) {
      if (rand() < v.nightProb[weekday]) {
        const category = pick(rand, v.categories);
        const organiserId = pick(rand, ORGANISER_FOR[category]);
        const priceCents = pick(rand, PRICES[category]);
        const capacity = organiserId === "u-aoife" || category === "Food & drink" ? v.seated : v.standing;
        const leadDays = pick<number>(rand, [
          [10, 1],
          [14, 2],
          [21, 2],
          [28, 2],
          [35, 2],
          [42, 2],
          [56, 1],
        ]);
        const sellThrough = clamp(
          WEEKDAY_SELL[weekday] +
            (CATEGORY_SELL[category] ?? 0) -
            (priceCents / 100 - 15) * 0.006 +
            (leadDays >= 28 ? 0.08 : 0) +
            (MONTH_SELL[month] ?? 0) +
            normal(rand, 0, 0.07),
          0.15,
          1,
        );
        const sold = Math.round(capacity * sellThrough);
        const noShow = clamp(
          0.09 + (weekday === 0 ? -0.045 : 0) + (weekday === 5 ? 0.03 : 0) + (priceCents < 1000 ? 0.04 : 0) + normal(rand, 0, 0.025),
          0,
          0.3,
        );
        const checkedIn = sold - Math.round(sold * noShow);
        const planted = weekday === 4 && priceCents >= 1000 && priceCents <= 1500 ? 1.24 : 1;
        const spend =
          v.spendCents * WEEKDAY_SPEND[weekday] * (CATEGORY_SPEND[category] ?? 1) * planted * Math.exp(normal(rand, 0, 0.12));
        const barRevenueCents = Math.round(checkedIn * spend);
        const durationMin = pick<number>(rand, [
          [180, 2],
          [210, 2],
          [240, 1],
        ]);
        const startTime = category === "Food & drink" ? "19:00" : category === "Comedy" ? "20:00" : "19:30";
        const ticketTypes: HistTicketType[] =
          organiserId === "u-aoife"
            ? (() => {
                const ebTotal = Math.round(capacity * 0.2);
                const ebSold = Math.min(ebTotal, sold);
                return [
                  { name: "Early bird", priceCents: priceCents - 300, total: ebTotal, sold: ebSold },
                  { name: "Standard", priceCents, total: capacity - ebTotal, sold: sold - ebSold },
                ];
              })()
            : [{ name: "General admission", priceCents, total: capacity, sold }];
        const id = `h-${(++n).toString().padStart(3, "0")}`;
        const bookingRevenueCents = venueId === "v-forge" && rand() < 0.3 ? 0 : v.roomFeeCents;
        events.push({
          id,
          title: pick(rand, TITLES[category].map((t) => [t, 1] as [string, number])),
          organiserId,
          organiserName: HISTORY_ORGANISERS[organiserId],
          venueId,
          category,
          weekday,
          date,
          startsAt: dublinToIso(date, startTime),
          durationMin,
          priceCents,
          capacity,
          leadDays,
          cumulative: salesCurve(rand, sold, leadDays),
          sold,
          checkedIn,
          ticketRevenueCents: ticketTypes.reduce((s, t) => s + t.sold * t.priceCents, 0),
          bar15: barProfile(rand, durationMin / 15, barRevenueCents),
          barRevenueCents,
          bookingRevenueCents,
          ticketTypes,
        });
        bookings.push({
          id: `hb-${id}`,
          venueId,
          date,
          weekday,
          kind: "event",
          revenueCents: bookingRevenueCents,
          barRevenueCents,
          eventId: id,
        });
      } else if (weekday !== 1 && rand() < 0.1) {
        // A private hire (birthday, work party): occupancy and booking revenue, no tickets.
        const guests = 30 + Math.round(rand() * 50);
        bookings.push({
          id: `hp-${venueId}-${date}`,
          venueId,
          date,
          weekday,
          kind: "private",
          revenueCents: v.roomFeeCents,
          barRevenueCents: Math.round(guests * v.spendCents * Math.exp(normal(rand, 0, 0.15))),
        });
      }
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return { events, bookings, openDates };
}

let cached: History | undefined;

/** The generated history (computed once; deterministic). */
export function getHistory(): History {
  cached ??= generate();
  return cached;
}
