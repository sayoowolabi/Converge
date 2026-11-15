import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { BlockedNotice } from "../../components/BlockedNotice";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { MapPanel } from "../../components/MapPanel";
import { StatusPill } from "../../components/StatusPill";
import { TicketModal } from "../../components/TicketModal";
import {
  formatDistance,
  formatLongDate,
  formatMoney,
  formatTimeRange,
  walkMinutes,
} from "../../domain/format";
import { remaining } from "../../domain/rules";
import { holdsTicket, useEventView, useStore } from "../../state/store";
import { NotFound } from "../NotFound";

/** Event page (FR 40): details, organiser and rating, venue, map, nearest stop, ticket types. */
export function EventPage() {
  const { eventId } = useParams();
  const view = useEventView(eventId);
  const { db, userId, toggleSave, logInteraction, toast } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const noticeRef = useRef<HTMLDivElement>(null);
  useDocumentTitle(view?.event.title ?? "Event not found");

  // FR 42: record the view from the first screen that shows an event.
  useEffect(() => {
    if (eventId && view) logInteraction("view", { eventId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!view || view.event.status === "Draft") return <NotFound what="event" />;
  const { event, venue, stop, organiser, ticketTypes, going, fromCents } = view;
  const onSale = event.status === "Published";
  const saved = db.savedEventIds.includes(event.id);
  const hasTicket = holdsTicket(db, userId, event.id);
  const heldOrder = db.orders.find((o) => o.eventId === event.id && o.userId === userId && o.status === "Reserved");
  const stopLabel = `${stop.mode}${stop.line ? ` ${stop.line}` : ""} · ${stop.name}`;

  const openTickets = () => {
    if (!onSale) {
      noticeRef.current?.focus();
      return;
    }
    setModalOpen(true);
  };

  return (
    <article className="page event-page">
      <Link className="back-link" to="/">
        <Icon name="back" size={16} /> What&rsquo;s on
      </Link>

      <div className="event-hero">
        <div className="event-hero-image">
          <img src={event.coverImage.url} alt={event.coverImage.alt} />
          <span className="category-pill">{event.category}</span>
        </div>
        <div className="event-hero-body">
          <p className="event-date">
            {formatLongDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
          </p>
          <h1 className="display-title">{event.title}</h1>
          <p className="modal-place">
            <Icon name="location" size={17} /> {venue.name}, {venue.area}
          </p>
          <p className="hero-meta">
            <span>
              <Icon name="users" size={16} /> {going} going
            </span>
            {event.welcomingSolo ? <span>Welcoming if you&rsquo;re on your own</span> : null}
            {event.status !== "Published" ? <StatusPill status={event.status} label="Event status" /> : null}
          </p>
          <div className="price-line">
            <span>
              <small>{onSale ? "FROM" : "WAS FROM"}</small>
              {formatMoney(fromCents)}
            </span>
            <span className="price-note">The price shown is the price you pay. Booking fees included.</span>
          </div>

          {hasTicket ? (
            <div className="going-banner">
              <Icon name="check" size={18} />
              <span>You&rsquo;re going.</span>
              <Link to="/tickets">View my tickets</Link>
              <Link to={`/events/${event.id}/community`}>Event community</Link>
            </div>
          ) : null}
          {heldOrder ? (
            <div className="going-banner hold">
              <Icon name="ticket" size={18} />
              <span>You have tickets on hold.</span>
              <Link to={`/checkout/${heldOrder.id}`}>Continue to checkout</Link>
            </div>
          ) : null}

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openTickets}
              aria-disabled={!onSale}
              aria-describedby={!onSale ? "tickets-blocked" : undefined}
            >
              <Icon name="ticket" /> Get tickets
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={saved}
              onClick={() => {
                const nowSaved = toggleSave(event.id);
                toast(nowSaved ? `Saved ${event.title}.` : `Removed ${event.title} from saved events.`);
              }}
            >
              <Icon name="heart" size={18} filled={saved} /> {saved ? "Saved" : "Save"}
            </button>
          </div>
          {!onSale ? (
            <BlockedNotice ref={noticeRef} id="tickets-blocked" code="TX1" title="Tickets aren't on sale">
              This event is {event.status}. Tickets can only be reserved while an event is Published and has
              tickets left.
            </BlockedNotice>
          ) : null}
        </div>
      </div>

      <div className="event-columns">
        <div>
          <section className="info-section" aria-labelledby="about-heading">
            <h2 id="about-heading">About this event</h2>
            <p className="lede">{event.description}</p>
          </section>

          <section className="info-section" aria-labelledby="tickets-heading">
            <h2 id="tickets-heading">Tickets</h2>
            <table className="data-table">
              <caption className="sr-only">Ticket types and availability</caption>
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Price</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>
              <tbody>
                {ticketTypes.map((t) => {
                  const left = remaining(t);
                  return (
                    <tr key={t.id}>
                      <th scope="row">
                        {t.name}
                        <small>{t.description}</small>
                      </th>
                      <td>{t.priceCents === 0 ? "Free" : formatMoney(t.priceCents)}</td>
                      <td>
                        {left === 0 ? (
                          <StatusPill status="Sold Out" />
                        ) : (
                          <span className={left <= 10 ? "low-stock" : undefined}>
                            {left <= 10 ? `Only ${left} left` : `${left} left`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="info-section organiser-card" aria-labelledby="organiser-heading">
            <span className="avatar large" aria-hidden="true">
              {organiser.initials}
            </span>
            <div>
              <p className="eyebrow">Organised by</p>
              <h2 id="organiser-heading">{organiser.organisation ?? organiser.name}</h2>
              {organiser.rating ? (
                <p className="rating">
                  <Icon name="star" size={16} filled />
                  <strong>{organiser.rating.average.toFixed(1)}</strong> from {organiser.rating.count} ratings of
                  past events
                </p>
              ) : (
                <p className="rating">No ratings yet: this is their first event on Converge.</p>
              )}
            </div>
          </section>

          <section className="info-section community-teaser" aria-labelledby="community-heading">
            <h2 id="community-heading">Event community</h2>
            {hasTicket ? (
              <p>
                Say hello before the night, or mark yourself as coming alone.{" "}
                <Link to={`/events/${event.id}/community`}>Open the community</Link>
              </p>
            ) : (
              <p>
                <Icon name="lock" size={16} /> Only ticket holders and the organiser can see this event&rsquo;s
                community. Get a ticket to join the conversation.
              </p>
            )}
          </section>
        </div>

        <aside className="getting-there" aria-labelledby="getting-there-heading">
          <h2 id="getting-there-heading">Getting there</h2>
          <p className="venue-name">{venue.name}</p>
          <p className="muted">{venue.address}</p>
          <div className="stop-card">
            <span className="stop-icon" aria-hidden="true">
              <Icon name="train" size={20} />
            </span>
            <div>
              <p className="eyebrow">Nearest stop</p>
              <p className="stop-name">{stopLabel}</p>
              <p className="muted">
                {formatDistance(venue.nearestStopM)}, about {walkMinutes(venue.nearestStopM)} min walk
              </p>
            </div>
          </div>
          <MapPanel
            title="Venue location"
            compact
            interactive={false}
            pins={[{ id: venue.id, x: venue.map.x, y: venue.map.y, text: venue.name, label: `${venue.name} on the map` }]}
          />
        </aside>
      </div>

      <button type="button" className="floating-ticket" onClick={openTickets} aria-disabled={!onSale}>
        <Icon name="ticket" />
        <span>{onSale ? "Get tickets" : "Sold out"}</span>
      </button>

      {modalOpen ? <TicketModal view={view} onClose={() => setModalOpen(false)} /> : null}
    </article>
  );
}
