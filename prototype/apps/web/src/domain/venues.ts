/**
 * Venue helpers for search and booking (FR 11, FR 15, FR 16).
 * In the real system the radius filter is PostGIS ST_DWithin and the
 * availability check is a tstzrange containment query.
 */
import { formatMoney } from "./format";
import { overlaps, within } from "./rules";
import type { Booking, Venue, VenuePackage } from "./types";

export const SEARCH_POINTS = [
  { id: "centre", label: "City centre (O’Connell Bridge)", lat: 53.3472, lon: -6.2592 },
  { id: "smithfield", label: "Smithfield", lat: 53.3478, lon: -6.2785 },
  { id: "portobello", label: "Portobello", lat: 53.3302, lon: -6.265 },
] as const;

export const PRICING_LABEL: Record<VenuePackage["model"], string> = {
  flat_fee: "Flat fee",
  per_person: "Per person",
  minimum_spend: "Minimum spend",
};

/** Estimated cost of a package for a guest count. */
export function estimateCost(pkg: VenuePackage, guests: number): number {
  return pkg.model === "per_person" ? pkg.priceCents * Math.max(guests, pkg.minGuests) : pkg.priceCents;
}

export function packagePrice(pkg: VenuePackage): string {
  const p = formatMoney(pkg.priceCents);
  if (pkg.model === "per_person") return `${p} per person`;
  if (pkg.model === "minimum_spend") return `${p} minimum bar spend`;
  return `${p} flat fee`;
}

/** Cheapest package that fits the guest count (FR 15 "price guide"). */
export function priceGuide(venue: Venue, guests: number): { pkg: VenuePackage; cost: number } | undefined {
  return venue.packages
    .filter((p) => guests >= p.minGuests && guests <= p.maxGuests)
    .map((pkg) => ({ pkg, cost: estimateCost(pkg, guests) }))
    .sort((a, b) => a.cost - b.cost)[0];
}

export function maxCapacity(venue: Venue): number {
  return Math.max(venue.capacityStanding, venue.capacitySeated);
}

/** Is the venue open and unbooked (no Approved/Confirmed overlap) for this slot? */
export function slotStatus(
  venue: Venue,
  startsAt: string,
  endsAt: string,
  bookings: Booking[],
): "available" | "closed" | "booked" {
  if (!venue.availability.some((w) => within(startsAt, endsAt, w.startsAt, w.endsAt))) return "closed";
  const held = bookings.some(
    (b) =>
      b.venueId === venue.id &&
      (b.status === "Approved" || b.status === "Confirmed") &&
      overlaps(startsAt, endsAt, b.startsAt, b.endsAt),
  );
  return held ? "booked" : "available";
}
