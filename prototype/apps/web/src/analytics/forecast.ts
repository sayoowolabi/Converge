/**
 * Ticket-sales forecast for events on sale (FR 70), pace-baseline method
 * (DECISIONS D-047). ml-design.md specifies a gradient-boosted quantile model
 * compared against "a pace projection using the average sales-curve shape of
 * similar past events"; the prototype implements that baseline only.
 */
import { DEMO_NOW, dublinDateKey } from "../domain/format";
import type { Category, Db } from "../domain/types";
import type { HistEvent } from "./history";
import { clamp, mulberry32, quantile } from "./stats";

export const MIN_SIMILAR = 8;

export interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  startsAt: string;
  weekday: number;
  venueId: string;
  category: Category;
  organiserId: string;
  capacity: number;
  sold: number;
  priceCents: number;
  daysOut: number;
  /** cumulative[d] for d = lead … daysOut (undefined after today). */
  cumulative: number[];
  lead: number;
}

/** On-sale history for the seeded upcoming events (the main seed only stores the current total). */
const SEEDED_LEAD: Record<string, number> = { "e-advent": 35, "e-midwinter": 42 };

const daysBetween = (fromKey: string, toKey: string) =>
  Math.round((new Date(`${toKey}T12:00:00Z`).getTime() - new Date(`${fromKey}T12:00:00Z`).getTime()) / 86400_000);

/** The organiser's Published / Sold Out events that haven't happened yet, from the live store. */
export function upcomingFromDb(db: Db, organiserId: string): UpcomingEvent[] {
  const today = dublinDateKey(DEMO_NOW);
  return db.events
    .filter((e) => e.organiserId === organiserId && (e.status === "Published" || e.status === "Sold Out"))
    .map((e) => {
      const date = dublinDateKey(e.startsAt);
      const daysOut = daysBetween(today, date);
      const types = db.ticketTypes.filter((t) => t.eventId === e.id);
      const sold = types.reduce((n, t) => n + t.quantitySold, 0);
      const capacity = types.reduce((n, t) => n + t.quantityTotal, 0);
      const lead = Math.max(daysOut, SEEDED_LEAD[e.id] ?? daysOut);
      // Rebuild a plausible to-date curve that ends at today's total.
      const rand = mulberry32(e.id.length * 7919 + sold);
      const early = 0.25 + rand() * 0.1;
      const cumulative: number[] = [];
      for (let d = lead; d >= daysOut; d--) {
        const x = lead === daysOut ? 1 : (lead - d) / (lead - daysOut);
        cumulative[d] = Math.round(sold * (early * Math.sqrt(x) + (1 - early) * x ** 1.6));
      }
      cumulative[daysOut] = sold;
      return {
        id: e.id,
        title: e.title,
        date,
        startsAt: e.startsAt,
        weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
        venueId: e.venueId,
        category: e.category,
        organiserId,
        capacity,
        sold,
        priceCents: types.length ? Math.max(...types.map((t) => t.priceCents)) : 0,
        daysOut,
        cumulative,
        lead,
      };
    })
    .filter((u) => u.daysOut >= 0 && u.capacity > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Forecast {
  event: UpcomingEvent;
  status: "below" | "on-track" | "ahead" | "no-history" | "too-early";
  similar: HistEvent[];
  similarRule: string;
  expectedNow: number;
  projected: number;
  low: number;
  high: number;
  /** Per day-before-event band of similar events, scaled to this event's capacity. */
  band: { d: number; p10: number; p50: number; p90: number }[];
}

export function forecastEvent(u: UpcomingEvent, past: HistEvent[]): Forecast {
  const eligible = (pool: HistEvent[]) => pool.filter((h) => h.leadDays >= u.daysOut && h.sold > 0);
  let similarRule = "your past events in the same category at the same venue";
  let similar = eligible(
    past.filter((h) => h.organiserId === u.organiserId && h.category === u.category && h.venueId === u.venueId),
  );
  if (similar.length < MIN_SIMILAR) {
    similarRule = "past events in the same category at the same venue";
    similar = eligible(past.filter((h) => h.category === u.category && h.venueId === u.venueId));
  }
  similar = similar.slice(-40);
  const base = { event: u, similar, similarRule, expectedNow: 0, projected: u.sold, low: u.sold, high: u.sold, band: [] };
  if (similar.length < MIN_SIMILAR) return { ...base, status: "no-history" };

  const maxD = Math.max(u.lead, u.daysOut);
  const band = Array.from({ length: maxD + 1 }, (_, d) => {
    const fr = similar.map((h) => (h.leadDays >= d ? h.cumulative[d] / h.capacity : 0));
    return {
      d,
      p10: quantile(fr, 0.1) * u.capacity,
      p50: quantile(fr, 0.5) * u.capacity,
      p90: quantile(fr, 0.9) * u.capacity,
    };
  });
  const expectedNow = band[u.daysOut].p50;
  if (u.lead - u.daysOut < 2 && u.sold === 0) return { ...base, band, expectedNow, status: "too-early" };

  const fracOfFinal = similar.map((h) => h.cumulative[u.daysOut] / h.sold).filter((f) => f > 0);
  const cap = (x: number) => Math.round(clamp(x, u.sold, u.capacity));
  const projected = u.sold ? cap(u.sold / quantile(fracOfFinal, 0.5)) : Math.round(band[0].p50 * 0.5);
  const low = u.sold ? cap(u.sold / quantile(fracOfFinal, 0.9)) : 0;
  const high = u.sold ? cap(u.sold / quantile(fracOfFinal, 0.1)) : Math.round(band[0].p50);
  const ratio = expectedNow > 0 ? u.sold / expectedNow : 1;
  const status = ratio < 0.75 ? "below" : ratio > 1.25 ? "ahead" : "on-track";
  return { ...base, band, expectedNow, projected, low, high, status };
}
