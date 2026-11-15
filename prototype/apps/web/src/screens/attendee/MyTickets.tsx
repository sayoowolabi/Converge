import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { QrPlaceholder } from "../../components/QrPlaceholder";
import { StatusPill } from "../../components/StatusPill";
import { DEMO_NOW, formatDistance, formatLongDate, formatMoney, formatTime, formatTimeRange, walkMinutes } from "../../domain/format";
import type { Order } from "../../domain/types";
import { useStore } from "../../state/store";

const ticketRef = (token: string) => `CNV-${token.slice(0, 4)}-${token.slice(4, 8)}`.toUpperCase();

/** My tickets (FR 50, FR 51): Paid tickets with a QR placeholder, held orders, and past tickets. */
export function MyTickets() {
  useDocumentTitle("My tickets");
  const { db, userId } = useStore();
  const location = useLocation();
  const highlight = (location.state as { highlightOrderId?: string } | null)?.highlightOrderId;
  const highlightRef = useRef<HTMLElement>(null);

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: "start" });
  }, [highlight]);

  const mine = db.orders.filter((o) => o.userId === userId);
  const eventOf = (o: Order) => db.events.find((e) => e.id === o.eventId)!;
  const held = mine.filter((o) => o.status === "Reserved");
  const paid = mine
    .filter((o) => o.status === "Paid")
    .sort((a, b) => eventOf(a).startsAt.localeCompare(eventOf(b).startsAt));
  const upcoming = paid.filter((o) => new Date(eventOf(o).endsAt) >= DEMO_NOW);
  const past = paid.filter((o) => new Date(eventOf(o).endsAt) < DEMO_NOW).reverse();

  const renderOrder = (order: Order, isPast: boolean) => {
    const event = eventOf(order);
    const venue = db.venues.find((v) => v.id === event.venueId)!;
    const stop = db.stops.find((s) => s.id === venue.nearestStopId)!;
    const tickets = db.tickets.filter((t) => t.orderId === order.id);
    const headingId = `order-${order.id}`;
    return (
      <article
        key={order.id}
        className={`ticket-order ${order.id === highlight ? "just-bought" : ""}`}
        aria-labelledby={headingId}
        ref={order.id === highlight ? highlightRef : undefined}
        data-testid="ticket-order"
      >
        <div className="ticket-order-head">
          <img src={event.coverImage.url} alt="" />
          <div>
            <p className="event-date">
              {formatLongDate(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
            </p>
            <h3 id={headingId}>
              <Link to={`/events/${event.id}`}>{event.title}</Link>
            </h3>
            <p className="muted">
              {venue.name}, {venue.area} · {stop.mode} {stop.name}, {formatDistance(venue.nearestStopM)} (
              {walkMinutes(venue.nearestStopM)} min walk)
            </p>
            {order.id === highlight ? (
              <p className="just-bought-note">
                <Icon name="check" size={16} /> Just bought. A confirmation email would be sent in the real app.
              </p>
            ) : null}
          </div>
        </div>
        <ul className="ticket-list">
          {tickets.map((t, i) => {
            const type = db.ticketTypes.find((tt) => tt.id === t.ticketTypeId)!;
            return (
              <li key={t.id} className="ticket-stub">
                {t.status === "Paid" ? (
                  <QrPlaceholder
                    token={t.qrToken}
                    label={`QR code placeholder for ticket ${i + 1}, ${type.name}, reference ${ticketRef(t.qrToken)}`}
                  />
                ) : (
                  <div className="qr-used" aria-hidden="true">
                    <Icon name="check" size={28} />
                  </div>
                )}
                <div>
                  <p className="ticket-type">
                    Ticket {i + 1} · {type.name}
                  </p>
                  <StatusPill status={t.status} label="Ticket status" />
                  <p className="muted small">Ref {ticketRef(t.qrToken)}</p>
                  {t.status === "Paid" ? (
                    <p className="muted small">Show this code at the door. Each code can be scanned once.</p>
                  ) : null}
                  {t.status === "Checked In" && t.checkedInAt ? (
                    <p className="muted small">Scanned at the door at {formatTime(t.checkedInAt)}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="ticket-order-foot">
          <span>
            Paid {formatMoney(order.totalCents, { exact: true })} · payment ref <code>{order.paymentRef}</code>
          </span>
          {!isPast ? (
            <Link to={`/events/${event.id}/community`}>
              Event community <Icon name="arrow" size={14} />
            </Link>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <section className="page">
      <p className="eyebrow">Your plans</p>
      <h1 className="page-title">My tickets</h1>

      {held.length ? (
        <section className="info-section" aria-labelledby="held-heading">
          <h2 id="held-heading">On hold</h2>
          <ul className="plain-list">
            {held.map((o) => (
              <li key={o.id} className="held-row">
                <StatusPill status="Reserved" />
                <span>{eventOf(o).title}</span>
                <Link to={`/checkout/${o.id}`}>Continue to checkout</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="info-section" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Upcoming</h2>
        {upcoming.length ? (
          <div className="ticket-orders">{upcoming.map((o) => renderOrder(o, false))}</div>
        ) : (
          <EmptyState title="No upcoming tickets yet">
            <p>When you buy a ticket it appears here with its QR code.</p>
            <Link className="btn btn-ink" to="/">
              Find something worth going to
            </Link>
          </EmptyState>
        )}
      </section>

      <section className="info-section" aria-labelledby="past-heading">
        <h2 id="past-heading">Past</h2>
        {past.length ? <div className="ticket-orders">{past.map((o) => renderOrder(o, true))}</div> : <p className="muted">No past tickets.</p>}
      </section>
    </section>
  );
}
