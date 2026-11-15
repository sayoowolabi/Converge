/**
 * In-memory store for the prototype (DECISIONS D-004).
 *
 * One context holds the mock database, the current role view and the toast
 * queue. Every action checks a guard in domain/rules.ts first; on refusal the
 * state is left untouched and the reason is returned for the UI to show.
 * Everything resets on reload or via "Reset demo".
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createSeed, DEMO_USER_ID } from "../data/seed";
import { DEMO_NOW, formatDay, newId, randomToken } from "../domain/format";
import {
  canApprove,
  canConfirm,
  canCreateEvent,
  canDecline,
  canPay,
  canPublish,
  canRequestBooking,
  canReserve,
  checkEventTimes,
  checkTicketType,
  remaining,
  type RuleResult,
  type TicketTypeInput,
} from "../domain/rules";
import type {
  AttendeeStatus,
  Booking,
  BookingStatus,
  ConvergeEvent,
  Db,
  InteractionKind,
  Notification,
  Role,
} from "../domain/types";

export const HOLD_MS = 10 * 60 * 1000;

export type Result = RuleResult & { id?: string };

export interface Toast {
  id: string;
  text: string;
}

export interface BookingRequest {
  venueId: string;
  packageId?: string;
  startsAt: string;
  endsAt: string;
  expectedGuests: number;
  message: string;
}

export type EventPatch = Partial<
  Pick<ConvergeEvent, "title" | "description" | "category" | "startsAt" | "endsAt" | "coverImage" | "welcomingSolo">
>;

interface Actions {
  setRole(role: Role): void;
  resetDemo(): void;
  toast(text: string): void;
  dismissToast(id: string): void;
  markNotificationsRead(): void;
  logInteraction(kind: InteractionKind, ids: { eventId?: string; venueId?: string }): void;
  toggleSave(eventId: string): boolean;
  reserveTickets(eventId: string, quantities: Record<string, number>): Result;
  payOrder(orderId: string): Result;
  releaseOrder(orderId: string, why: "cancelled" | "expired"): void;
  requestBooking(input: BookingRequest): Result;
  approveBooking(bookingId: string): Result;
  declineBooking(bookingId: string, reason: string): Result;
  confirmBooking(bookingId: string): Result;
  createEventFromBooking(bookingId: string | undefined): Result;
  updateEvent(eventId: string, patch: EventPatch): Result;
  addTicketType(eventId: string, input: TicketTypeInput & { description: string }): Result;
  removeTicketType(ticketTypeId: string): void;
  publishEvent(eventId: string): Result;
  addPost(eventId: string, body: string, parentId?: string): Result;
  deletePost(postId: string): void;
  setAttendeeStatus(eventId: string, patch: Partial<Pick<AttendeeStatus, "attendingAlone" | "openToMessages">>): void;
}

export interface Store extends Actions {
  db: Db;
  role: Role;
  userId: string;
  toasts: Toast[];
}

const StoreContext = createContext<Store | null>(null);

const nowIso = () => new Date().toISOString();

/** Booking/order history timestamps use the demo clock's date with the real time of day. */
function demoStamp(): string {
  const real = new Date();
  const d = new Date(DEMO_NOW);
  d.setUTCHours(real.getUTCHours(), real.getUTCMinutes(), real.getUTCSeconds());
  return d.toISOString();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(createSeed);
  const [role, setRoleState] = useState<Role>("attendee");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dbRef = useRef(db);
  dbRef.current = db;

  const actions = useMemo<Actions>(() => {
    const userId = DEMO_USER_ID;
    const get = () => dbRef.current;
    const commit = (next: Db) => {
      dbRef.current = next;
      setDb(next);
    };
    const notify = (text: string, forRole: Role, link?: string): Notification => ({
      id: newId("n"),
      userId,
      text,
      link,
      forRole,
      at: nowIso(),
      read: false,
    });
    const toast = (text: string) => {
      const id = newId("toast");
      setToasts([{ id, text }]); // one at a time, so toasts never stack over content
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    };
    const setBookingStatus = (b: Booking, status: BookingStatus, note?: string): Booking => ({
      ...b,
      status,
      history: [...b.history, { status, at: demoStamp(), by: userId, note }],
    });
    const releaseInto = (state: Db, orderId: string): Db => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order || order.status !== "Reserved") return state;
      const ticketTypes = state.ticketTypes.map((tt) => {
        const line = order.lines.find((l) => l.ticketTypeId === tt.id);
        return line ? { ...tt, quantitySold: Math.max(0, tt.quantitySold - line.quantity) } : tt;
      });
      // ET6: a released ticket returns a Sold Out event to Published.
      const events = state.events.map((e) =>
        e.id === order.eventId && e.status === "Sold Out" ? { ...e, status: "Published" as const } : e,
      );
      return {
        ...state,
        ticketTypes,
        events,
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: "Released" as const } : o)),
        tickets: state.tickets.map((t) => (t.orderId === orderId ? { ...t, status: "Released" as const } : t)),
      };
    };

    return {
      setRole(next) {
        setRoleState(next);
      },
      resetDemo() {
        commit(createSeed());
        setRoleState("attendee");
        toast("Demo data reset.");
      },
      toast,
      dismissToast(id) {
        setToasts((t) => t.filter((x) => x.id !== id));
      },
      markNotificationsRead() {
        const s = get();
        if (!s.notifications.some((n) => !n.read)) return;
        commit({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) });
      },
      logInteraction(kind, ids) {
        const s = get();
        commit({ ...s, interactions: [...s.interactions, { userId, kind, ...ids, at: nowIso() }] });
      },
      toggleSave(eventId) {
        const s = get();
        const saved = s.savedEventIds.includes(eventId);
        commit({
          ...s,
          savedEventIds: saved ? s.savedEventIds.filter((id) => id !== eventId) : [...s.savedEventIds, eventId],
          interactions: [...s.interactions, { userId, kind: saved ? "unsave" : "save", eventId, at: nowIso() }],
        });
        return !saved;
      },

      /* ------------------------------------------------------- Ticketing */
      reserveTickets(eventId, quantities) {
        const s = get();
        const event = s.events.find((e) => e.id === eventId);
        if (!event) return { ok: false, code: "404", title: "Event not found", reason: "This event no longer exists." };
        const lines = s.ticketTypes
          .filter((tt) => tt.eventId === eventId)
          .map((ticketType) => ({ ticketType, quantity: quantities[ticketType.id] ?? 0 }))
          .filter((l) => l.quantity > 0);
        const check = canReserve(event, lines);
        if (!check.ok) return check;
        const orderId = newId("o");
        const subtotal = lines.reduce((n, l) => n + l.quantity * l.ticketType.priceCents, 0);
        const tickets = lines.flatMap((l) =>
          Array.from({ length: l.quantity }, () => ({
            id: newId("t"),
            orderId,
            eventId,
            ticketTypeId: l.ticketType.id,
            holderId: userId,
            qrToken: randomToken(),
            status: "Reserved" as const,
          })),
        );
        commit({
          ...s,
          // The hold counts against stock straight away, so two buyers can't take the last ticket (FR 48).
          ticketTypes: s.ticketTypes.map((tt) => {
            const l = lines.find((x) => x.ticketType.id === tt.id);
            return l ? { ...tt, quantitySold: tt.quantitySold + l.quantity } : tt;
          }),
          orders: [
            ...s.orders,
            {
              id: orderId,
              userId,
              eventId,
              lines: lines.map((l) => ({
                ticketTypeId: l.ticketType.id,
                quantity: l.quantity,
                unitPriceCents: l.ticketType.priceCents,
              })),
              subtotalCents: subtotal,
              discountCents: 0,
              feeCents: 0,
              totalCents: subtotal,
              status: "Reserved",
              createdAt: nowIso(),
              holdExpiresAtMs: Date.now() + HOLD_MS,
            },
          ],
          tickets: [...s.tickets, ...tickets],
        });
        return { ok: true, id: orderId };
      },
      payOrder(orderId) {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        if (!order) return { ok: false, code: "404", title: "Order not found", reason: "This order no longer exists." };
        const check = canPay(order, Date.now());
        if (!check.ok) {
          if (check.code === "TT3") commit(releaseInto(s, orderId));
          return check;
        }
        const event = s.events.find((e) => e.id === order.eventId)!;
        // ET5: when nothing is left in any ticket type, the event becomes Sold Out.
        const soldOut = s.ticketTypes.filter((tt) => tt.eventId === event.id).every((tt) => remaining(tt) === 0);
        const qty = order.lines.reduce((n, l) => n + l.quantity, 0);
        commit({
          ...s,
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: "Paid", paymentRef: `pi_test_${randomToken(8)}` } : o,
          ),
          tickets: s.tickets.map((t) => (t.orderId === orderId ? { ...t, status: "Paid" } : t)),
          events: s.events.map((e) => (e.id === event.id && soldOut ? { ...e, status: "Sold Out" } : e)),
          interactions: [...s.interactions, { userId, kind: "purchase", eventId: event.id, at: nowIso() }],
          notifications: [
            notify(
              `You're going! ${qty} ticket${qty > 1 ? "s" : ""} for ${event.title} are in My tickets.`,
              "attendee",
              "/tickets",
            ),
            ...s.notifications,
          ],
        });
        return { ok: true, id: orderId };
      },
      releaseOrder(orderId, why) {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        if (!order || order.status !== "Reserved") return;
        commit(releaseInto(s, orderId));
        toast(why === "expired" ? "Your 10-minute hold ended. The tickets were released." : "Order cancelled. The tickets were released.");
      },

      /* -------------------------------------------------------- Bookings */
      requestBooking(input) {
        const s = get();
        const venue = s.venues.find((v) => v.id === input.venueId);
        if (!venue) return { ok: false, code: "404", title: "Venue not found", reason: "" };
        const check = canRequestBooking({ venue, ...input }, s.bookings);
        if (!check.ok) return check;
        const pkg = venue.packages.find((p) => p.id === input.packageId);
        const quoted = pkg ? (pkg.model === "per_person" ? pkg.priceCents * input.expectedGuests : pkg.priceCents) : 0;
        const booking: Booking = {
          id: newId("b"),
          venueId: venue.id,
          packageId: input.packageId,
          organiserId: userId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          expectedGuests: input.expectedGuests,
          message: input.message,
          status: "Pending",
          quotedPriceCents: quoted,
          depositCents: pkg?.depositCents ?? 0,
          history: [{ status: "Pending", at: demoStamp(), by: userId }],
        };
        commit({
          ...s,
          bookings: [...s.bookings, booking],
          interactions: [...s.interactions, { userId, kind: "enquiry", venueId: venue.id, at: nowIso() }],
          notifications: [
            notify(
              `New booking request for ${venue.name} on ${formatDay(booking.startsAt)}.`,
              "venue_operator",
              `/venue/bookings/${booking.id}`,
            ),
            ...s.notifications,
          ],
        });
        return { ok: true, id: booking.id };
      },
      approveBooking(bookingId) {
        const s = get();
        const booking = s.bookings.find((b) => b.id === bookingId);
        const venue = booking && s.venues.find((v) => v.id === booking.venueId);
        if (!booking || !venue) return { ok: false, code: "404", title: "Not found", reason: "" };
        const check = canApprove(booking, s.bookings, userId, venue);
        if (!check.ok) return check;
        commit({
          ...s,
          bookings: s.bookings.map((b) => (b.id === bookingId ? setBookingStatus(b, "Approved") : b)),
          notifications:
            booking.organiserId === userId
              ? [
                  notify(
                    `${venue.name} approved your booking for ${formatDay(booking.startsAt)}. Pay the deposit to confirm it.`,
                    "organiser",
                    `/organiser/bookings/${booking.id}`,
                  ),
                  ...s.notifications,
                ]
              : s.notifications,
        });
        return { ok: true, id: bookingId };
      },
      declineBooking(bookingId, reason) {
        const s = get();
        const booking = s.bookings.find((b) => b.id === bookingId);
        const venue = booking && s.venues.find((v) => v.id === booking.venueId);
        if (!booking || !venue) return { ok: false, code: "404", title: "Not found", reason: "" };
        const check = canDecline(booking, reason, userId, venue);
        if (!check.ok) return check;
        commit({
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId ? { ...setBookingStatus(b, "Rejected", reason.trim()), declineReason: reason.trim() } : b,
          ),
          notifications:
            booking.organiserId === userId
              ? [
                  notify(`${venue.name} declined your booking request.`, "organiser", `/organiser/bookings/${booking.id}`),
                  ...s.notifications,
                ]
              : s.notifications,
        });
        return { ok: true, id: bookingId };
      },
      confirmBooking(bookingId) {
        const s = get();
        const booking = s.bookings.find((b) => b.id === bookingId);
        if (!booking) return { ok: false, code: "404", title: "Not found", reason: "" };
        const check = canConfirm(booking, userId);
        if (!check.ok) return check;
        const venue = s.venues.find((v) => v.id === booking.venueId)!;
        commit({
          ...s,
          bookings: s.bookings.map((b) => (b.id === bookingId ? setBookingStatus(b, "Confirmed", "Deposit paid (test mode)") : b)),
          notifications: [
            notify(
              `Deposit received: the booking at ${venue.name} on ${formatDay(booking.startsAt)} is Confirmed.`,
              "venue_operator",
              `/venue/bookings/${bookingId}`,
            ),
            ...s.notifications,
          ],
        });
        return { ok: true, id: bookingId };
      },

      /* ---------------------------------------------------------- Events */
      createEventFromBooking(bookingId) {
        const s = get();
        const booking = s.bookings.find((b) => b.id === bookingId);
        const check = canCreateEvent(booking, s.events, userId);
        if (!check.ok || !booking) return check;
        const venue = s.venues.find((v) => v.id === booking.venueId)!;
        const event: ConvergeEvent = {
          id: newId("e"),
          bookingId: booking.id,
          venueId: venue.id, // location comes from the venue (a trigger does this in the real DB)
          organiserId: userId,
          category: "Food & drink",
          title: "",
          description: "",
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          status: "Draft",
          coverImage: venue.photos[0],
          welcomingSolo: true,
        };
        commit({ ...s, events: [...s.events, event] });
        return { ok: true, id: event.id };
      },
      updateEvent(eventId, patch) {
        const s = get();
        const event = s.events.find((e) => e.id === eventId);
        if (!event) return { ok: false, code: "404", title: "Not found", reason: "" };
        const next = { ...event, ...patch };
        if (patch.startsAt || patch.endsAt) {
          const booking = s.bookings.find((b) => b.id === event.bookingId)!;
          const check = checkEventTimes(next, booking);
          if (!check.ok) return check;
        }
        commit({ ...s, events: s.events.map((e) => (e.id === eventId ? next : e)) });
        return { ok: true, id: eventId };
      },
      addTicketType(eventId, input) {
        const s = get();
        const check = checkTicketType(input);
        if (!check.ok) return check;
        const id = newId("tt");
        commit({
          ...s,
          ticketTypes: [...s.ticketTypes, { id, eventId, ...input, name: input.name.trim(), quantitySold: 0 }],
        });
        return { ok: true, id };
      },
      removeTicketType(ticketTypeId) {
        const s = get();
        commit({ ...s, ticketTypes: s.ticketTypes.filter((t) => t.id !== ticketTypeId) });
      },
      publishEvent(eventId) {
        const s = get();
        const event = s.events.find((e) => e.id === eventId);
        if (!event) return { ok: false, code: "404", title: "Not found", reason: "" };
        const booking = s.bookings.find((b) => b.id === event.bookingId);
        const check = canPublish(event, booking, s.ticketTypes);
        if (!check.ok) return check;
        commit({
          ...s,
          events: s.events.map((e) => (e.id === eventId ? { ...e, status: "Published", publishedAt: nowIso() } : e)),
          notifications: [notify(`${event.title} is live on the map.`, "organiser", `/events/${eventId}`), ...s.notifications],
        });
        return { ok: true, id: eventId };
      },

      /* ------------------------------------------------------- Community */
      addPost(eventId, body, parentId) {
        const s = get();
        if (!body.trim()) return { ok: false, code: "POST", title: "Write something first", reason: "Your post is empty." };
        const id = newId("p");
        commit({
          ...s,
          posts: [...s.posts, { id, eventId, authorId: userId, parentId, body: body.trim(), createdAt: nowIso() }],
        });
        return { ok: true, id };
      },
      deletePost(postId) {
        const s = get();
        // Deleting a post also removes its replies from view.
        commit({ ...s, posts: s.posts.filter((p) => p.id !== postId && p.parentId !== postId) });
      },
      setAttendeeStatus(eventId, patch) {
        const s = get();
        const existing = s.attendeeStatus.find((a) => a.eventId === eventId && a.userId === userId);
        const next: AttendeeStatus = {
          eventId,
          userId,
          attendingAlone: false,
          openToMessages: false,
          ...existing,
          ...patch,
        };
        commit({
          ...s,
          attendeeStatus: [...s.attendeeStatus.filter((a) => !(a.eventId === eventId && a.userId === userId)), next],
        });
      },
    };
  }, []);

  // Release holds whose 10 minutes are up (TT3), even if the checkout page isn't open.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const expired = dbRef.current.orders.filter((o) => o.status === "Reserved" && Date.now() >= o.holdExpiresAtMs);
      expired.forEach((o) => actions.releaseOrder(o.id, "expired"));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [actions]);

  const value = useMemo<Store>(
    () => ({ db, role, userId: DEMO_USER_ID, toasts, ...actions }),
    [db, role, toasts, actions],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

/* ------------------------------------------------------------ Selectors */

export function useEventView(eventId: string | undefined) {
  const { db } = useStore();
  return useMemo(() => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return undefined;
    const venue = db.venues.find((v) => v.id === event.venueId)!;
    const stop = db.stops.find((s) => s.id === venue.nearestStopId)!;
    const organiser = db.users.find((u) => u.id === event.organiserId)!;
    const ticketTypes = db.ticketTypes.filter((t) => t.eventId === event.id);
    const going = ticketTypes.reduce((n, t) => n + t.quantitySold, 0);
    const fromCents = ticketTypes.length ? Math.min(...ticketTypes.map((t) => t.priceCents)) : 0;
    return { event, venue, stop, organiser, ticketTypes, going, fromCents };
  }, [db, eventId]);
}

export type EventView = NonNullable<ReturnType<typeof useEventView>>;

/** Does the demo user hold a Paid or Checked In ticket for this event? (FR 58 gate) */
export function holdsTicket(db: Db, userId: string, eventId: string): boolean {
  return db.tickets.some(
    (t) => t.eventId === eventId && t.holderId === userId && (t.status === "Paid" || t.status === "Checked In"),
  );
}
