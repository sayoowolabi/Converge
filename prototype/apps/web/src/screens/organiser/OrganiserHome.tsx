import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { BlockedNotice } from "../../components/BlockedNotice";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { formatDay, formatTimeRange } from "../../domain/format";
import { canCreateEvent, type RuleResult } from "../../domain/rules";
import type { Booking } from "../../domain/types";
import { useStore } from "../../state/store";

/**
 * "Create event" entry point with the EX1 guard (FR 26). Shared by the
 * dashboard and My events. With exactly one usable Confirmed booking it
 * creates the event straight away; with several it lists them.
 */
export function CreateEventButton() {
  const { db, userId, createEventFromBooking, toast } = useStore();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState<RuleResult | null>(null);
  const [choosing, setChoosing] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  const usable = db.bookings.filter(
    (b) => b.organiserId === userId && canCreateEvent(b, db.events, userId).ok,
  );

  const create = (booking: Booking | undefined) => {
    const result = createEventFromBooking(booking?.id);
    if (!result.ok) {
      setBlocked(result);
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    toast("Draft event created from your booking.");
    navigate(`/organiser/events/${result.id}`);
  };

  return (
    <div className="create-event">
      <button
        type="button"
        className="btn btn-primary"
        aria-describedby={blocked && !blocked.ok ? "create-blocked" : undefined}
        onClick={() => (usable.length > 1 ? setChoosing(!choosing) : create(usable[0]))}
        aria-expanded={usable.length > 1 ? choosing : undefined}
      >
        <Icon name="plus" size={18} /> Create event
      </button>
      {choosing ? (
        <ul className="choice-list" aria-label="Choose a confirmed booking">
          {usable.map((b) => {
            const venue = db.venues.find((v) => v.id === b.venueId)!;
            return (
              <li key={b.id}>
                <button type="button" className="text-button" onClick={() => create(b)}>
                  {venue.name}, {formatDay(b.startsAt)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {blocked && !blocked.ok ? (
        <BlockedNotice ref={noticeRef} id="create-blocked" code={blocked.code} title={blocked.title}>
          <p>{blocked.reason}</p>
          <Link className="btn btn-ink" to="/organiser/venues">
            Find a venue
          </Link>
        </BlockedNotice>
      ) : null}
    </div>
  );
}

export function BookingRows({ bookings }: { bookings: Booking[] }) {
  const { db } = useStore();
  return (
    <ul className="row-list">
      {bookings.map((b) => {
        const venue = db.venues.find((v) => v.id === b.venueId)!;
        const event = db.events.find((e) => e.bookingId === b.id);
        return (
          <li key={b.id} className="row-card" data-testid="booking-row">
            <div>
              <p className="event-date">
                {formatDay(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)}
              </p>
              <h3>
                <Link to={`/organiser/bookings/${b.id}`}>{venue.name}</Link>
              </h3>
              <p className="muted small">
                {b.expectedGuests} guests{event ? ` · Event: ${event.title || "Untitled draft"}` : ""}
              </p>
            </div>
            <StatusPill status={b.status} label="Booking status" />
          </li>
        );
      })}
    </ul>
  );
}

export function EventRows() {
  const { db, userId } = useStore();
  const mine = db.events.filter((e) => e.organiserId === userId);
  if (!mine.length) {
    return (
      <EmptyState title="No events yet">
        <p>Events are created from a Confirmed venue booking.</p>
      </EmptyState>
    );
  }
  return (
    <ul className="row-list">
      {mine.map((e) => {
        const venue = db.venues.find((v) => v.id === e.venueId)!;
        return (
          <li key={e.id} className="row-card" data-testid="event-row">
            <div>
              <p className="event-date">{formatDay(e.startsAt)}</p>
              <h3>
                <Link to={`/organiser/events/${e.id}`}>{e.title || "Untitled draft"}</Link>
              </h3>
              <p className="muted small">{venue.name}</p>
            </div>
            <StatusPill status={e.status} label="Event status" />
          </li>
        );
      })}
    </ul>
  );
}

/** Organiser dashboard: bookings and events (FR 19–FR 29). */
export function OrganiserHome() {
  useDocumentTitle("Organiser dashboard");
  const { db, userId } = useStore();
  const user = db.users.find((u) => u.id === userId)!;
  const bookings = db.bookings.filter((b) => b.organiserId === userId);
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Organiser · {user.organisation}</p>
          <h1 className="page-title">Your dashboard</h1>
        </div>
        <CreateEventButton />
      </div>

      <div className="two-col">
        <section className="info-section" aria-labelledby="bookings-heading">
          <div className="section-head">
            <h2 id="bookings-heading">Venue bookings</h2>
            <Link to="/organiser/venues">Find a venue</Link>
          </div>
          {bookings.length ? (
            <BookingRows bookings={bookings} />
          ) : (
            <EmptyState title="No bookings yet">
              <p>Every event starts with a venue. Search by guest numbers, date and how easy it is to get to.</p>
              <Link className="btn btn-ink" to="/organiser/venues">
                Find a venue
              </Link>
            </EmptyState>
          )}
        </section>
        <section className="info-section" aria-labelledby="events-heading">
          <div className="section-head">
            <h2 id="events-heading">Your events</h2>
            <Link to="/organiser/events">All events</Link>
          </div>
          <EventRows />
        </section>
      </div>
    </section>
  );
}

export function MyEvents() {
  useDocumentTitle("My events");
  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Organiser</p>
          <h1 className="page-title">My events</h1>
        </div>
        <CreateEventButton />
      </div>
      <EventRows />
    </section>
  );
}
