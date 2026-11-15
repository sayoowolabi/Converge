/**
 * Domain guards for the prototype.
 *
 * Each guard mirrors a row of the booking (B), event (E) or ticket (T)
 * state transition tables; codes such as BX2 or EX3 match those tables.
 * In the real system these checks live in the Express service layer and are
 * backed by database constraints (ADR 002, ADR 006, NFR 13). Here they run
 * in the browser as a stand-in (DECISIONS D-008). Guards are pure: they
 * never change state, so a refusal "changes nothing" (FR 3).
 */
import type { Booking, ConvergeEvent, Order, TicketType, Venue } from "./types";

export type RuleResult = { ok: true } | { ok: false; code: string; title: string; reason: string };

const ok: RuleResult = { ok: true };
const fail = (code: string, title: string, reason: string): RuleResult => ({ ok: false, code, title, reason });

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function within(innerStart: string, innerEnd: string, outerStart: string, outerEnd: string): boolean {
  return new Date(innerStart) >= new Date(outerStart) && new Date(innerEnd) <= new Date(outerEnd);
}

export function remaining(tt: TicketType): number {
  return Math.max(0, tt.quantityTotal - tt.quantitySold);
}

/* ---------------------------------------------------------------- Tickets */

export interface ReserveLine {
  ticketType: TicketType;
  quantity: number;
}

/** TT1 Reserve. TX1: only Published events. TX2/FR 48: never beyond stock. FR 46: per-order maximum. */
export function canReserve(event: ConvergeEvent, lines: ReserveLine[]): RuleResult {
  if (event.status !== "Published") {
    return fail(
      "TX1",
      "Tickets aren't on sale",
      `Tickets can't be reserved for an event that is ${event.status}.`,
    );
  }
  const total = lines.reduce((n, l) => n + l.quantity, 0);
  if (total <= 0) return fail("QTY", "Choose your tickets", "Add at least one ticket to continue.");
  for (const { ticketType, quantity } of lines) {
    if (quantity > ticketType.maxPerOrder) {
      return fail(
        "MAX",
        "Too many tickets",
        `You can buy up to ${ticketType.maxPerOrder} ${ticketType.name} tickets per order.`,
      );
    }
    if (quantity > remaining(ticketType)) {
      return fail(
        "TX2",
        "Not enough tickets left",
        `Only ${remaining(ticketType)} ${ticketType.name} tickets are left.`,
      );
    }
  }
  return ok;
}

/** TT2 Pay. Only a Reserved order whose hold hasn't expired (TT3). */
export function canPay(order: Order, nowMs: number): RuleResult {
  if (order.status === "Paid") return fail("TX-PAID", "Already paid", "This order has already been paid.");
  if (order.status !== "Reserved" || nowMs >= order.holdExpiresAtMs) {
    return fail(
      "TT3",
      "Your hold has expired",
      "Tickets are held for 10 minutes. This hold ended and the tickets went back on sale.",
    );
  }
  return ok;
}

/* --------------------------------------------------------------- Bookings */

export interface BookingRequestInput {
  venue: Venue;
  packageId?: string;
  startsAt: string;
  endsAt: string;
  expectedGuests: number;
}

/** BT1 Request. Must sit inside availability (FR 19) and not over a Confirmed slot (BX1). */
export function canRequestBooking(input: BookingRequestInput, bookings: Booking[]): RuleResult {
  const { venue, startsAt, endsAt, expectedGuests } = input;
  if (!venue.listed) return fail("LISTING", "Not bookable", `${venue.name} isn't listed for bookings.`);
  if (new Date(endsAt) <= new Date(startsAt)) {
    return fail("TIME", "Check the times", "The end time must be after the start time.");
  }
  if (!venue.availability.some((w) => within(startsAt, endsAt, w.startsAt, w.endsAt))) {
    return fail(
      "AVAIL",
      "Outside the venue's availability",
      `${venue.name} isn't available for the whole of that time. Pick a time inside one of its availability windows.`,
    );
  }
  const capacity = Math.max(venue.capacityStanding, venue.capacitySeated);
  if (expectedGuests < 1) return fail("GUESTS", "Add your guest numbers", "Expected guests must be at least 1.");
  if (expectedGuests > capacity) {
    return fail("GUESTS", "Too many guests", `${venue.name} holds up to ${capacity} people.`);
  }
  const pkg = venue.packages.find((p) => p.id === input.packageId);
  if (pkg && (expectedGuests < pkg.minGuests || expectedGuests > pkg.maxGuests)) {
    return fail(
      "PACKAGE",
      "Guest numbers don't fit this package",
      `${pkg.name} is for ${pkg.minGuests}–${pkg.maxGuests} guests.`,
    );
  }
  const confirmedClash = bookings.find(
    (b) =>
      b.venueId === venue.id &&
      b.status === "Confirmed" &&
      overlaps(startsAt, endsAt, b.startsAt, b.endsAt),
  );
  if (confirmedClash) {
    return fail(
      "BX1",
      "That slot is already booked",
      "Another organiser has a Confirmed booking at this venue for an overlapping time.",
    );
  }
  return ok;
}

/** Approved or Confirmed bookings at the same venue overlapping this one (FR 20, FR 21). */
export function clashingBookings(booking: Booking, bookings: Booking[]): Booking[] {
  return bookings.filter(
    (b) =>
      b.id !== booking.id &&
      b.venueId === booking.venueId &&
      (b.status === "Approved" || b.status === "Confirmed") &&
      overlaps(booking.startsAt, booking.endsAt, b.startsAt, b.endsAt),
  );
}

/** Pending bookings at the same venue overlapping this one (shown to the operator). */
export function pendingOverlaps(booking: Booking, bookings: Booking[]): Booking[] {
  return bookings.filter(
    (b) =>
      b.id !== booking.id &&
      b.venueId === booking.venueId &&
      b.status === "Pending" &&
      overlaps(booking.startsAt, booking.endsAt, b.startsAt, b.endsAt),
  );
}

/** BT2 Approve. BX2: never two Approved/Confirmed bookings overlapping (DB EXCLUDE constraint). */
export function canApprove(booking: Booking, bookings: Booking[], userId: string, venue: Venue): RuleResult {
  if (!venue.memberIds.includes(userId)) {
    return fail("403", "Not your venue", "Only the venue's owner or managers can decide on this request.");
  }
  if (booking.status !== "Pending") {
    return fail("BX6", "Already decided", `This request is ${booking.status} and can't be approved.`);
  }
  const clash = clashingBookings(booking, bookings);
  if (clash.length > 0) {
    return fail(
      "BX2",
      "Clashes with another booking",
      "This time overlaps a booking you've already approved. Two approved or confirmed bookings can't overlap at one venue.",
    );
  }
  return ok;
}

/** BT3 Decline. A reason is required (FR 20). */
export function canDecline(booking: Booking, reason: string, userId: string, venue: Venue): RuleResult {
  if (!venue.memberIds.includes(userId)) {
    return fail("403", "Not your venue", "Only the venue's owner or managers can decide on this request.");
  }
  if (booking.status !== "Pending") {
    return fail("BX6", "Already decided", `This request is ${booking.status} and can't be declined.`);
  }
  if (reason.trim().length < 3) {
    return fail("REASON", "Give a reason", "Tell the organiser why you're declining.");
  }
  return ok;
}

/** BT6 Confirm with deposit. Only the organiser, only from Approved. */
export function canConfirm(booking: Booking, userId: string): RuleResult {
  if (booking.organiserId !== userId) return fail("403", "Not your booking", "Only the organiser can confirm.");
  if (booking.status !== "Approved") {
    return fail(
      "BX-CONFIRM",
      "Waiting for the venue",
      booking.status === "Pending"
        ? "The venue needs to approve this request before you can pay the deposit."
        : `A ${booking.status} booking can't be confirmed.`,
    );
  }
  return ok;
}

/* ----------------------------------------------------------------- Events */

/** ET1 Create. EX1: needs one of my Confirmed bookings; one event per booking. */
export function canCreateEvent(
  booking: Booking | undefined,
  events: ConvergeEvent[],
  userId: string,
): RuleResult {
  if (!booking || booking.status !== "Confirmed") {
    return fail(
      "EX1",
      "You need a Confirmed booking first",
      booking
        ? `This booking is ${booking.status}. An event can only be created from a Confirmed booking (deposit paid).`
        : "Every event takes place at a booked venue. Book a venue and confirm it with the deposit, then create your event from that booking.",
    );
  }
  if (booking.organiserId !== userId) return fail("403", "Not your booking", "You can only use your own bookings.");
  if (events.some((e) => e.bookingId === booking.id && e.status !== "Cancelled")) {
    return fail("ET1", "Event already created", "Each booking can have one event.");
  }
  return ok;
}

/** Event times must sit inside the booked time (FR 26). */
export function checkEventTimes(event: Pick<ConvergeEvent, "startsAt" | "endsAt">, booking: Booking): RuleResult {
  if (new Date(event.endsAt) <= new Date(event.startsAt)) {
    return fail("TIME", "Check the times", "The event must end after it starts.");
  }
  if (!within(event.startsAt, event.endsAt, booking.startsAt, booking.endsAt)) {
    return fail("TIME", "Outside your booking", "The event's start and end must fall inside your booked time.");
  }
  return ok;
}

/** ET2 Publish. EX2: booking must be Confirmed. EX3: at least one ticket type. */
export function canPublish(event: ConvergeEvent, booking: Booking | undefined, ticketTypes: TicketType[]): RuleResult {
  if (event.status !== "Draft") {
    return fail("EX-STATE", "Already published", `This event is ${event.status}.`);
  }
  if (!booking || booking.status !== "Confirmed") {
    return fail("EX2", "Booking isn't Confirmed", "An event can only be published while its venue booking is Confirmed.");
  }
  if (!event.title.trim()) return fail("DETAILS", "Add a title", "Give your event a title before publishing.");
  const times = checkEventTimes(event, booking);
  if (!times.ok) return times;
  if (ticketTypes.filter((t) => t.eventId === event.id).length === 0) {
    return fail(
      "EX3",
      "Add a ticket type first",
      "Attendees need something to buy. Add at least one ticket type (free is fine), then publish.",
    );
  }
  return ok;
}

export interface TicketTypeInput {
  name: string;
  priceCents: number;
  quantityTotal: number;
  maxPerOrder: number;
}

/** FR 28 ticket type validation. */
export function checkTicketType(input: TicketTypeInput): RuleResult {
  if (!input.name.trim()) return fail("TT-NAME", "Name the ticket type", "For example “General admission”.");
  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    return fail("TT-PRICE", "Check the price", "Price must be €0 or more.");
  }
  if (!Number.isInteger(input.quantityTotal) || input.quantityTotal < 1) {
    return fail("TT-QTY", "Check the quantity", "Quantity must be at least 1.");
  }
  if (!Number.isInteger(input.maxPerOrder) || input.maxPerOrder < 1 || input.maxPerOrder > input.quantityTotal) {
    return fail("TT-MAX", "Check the per-order limit", "Max per order must be between 1 and the quantity.");
  }
  return ok;
}
