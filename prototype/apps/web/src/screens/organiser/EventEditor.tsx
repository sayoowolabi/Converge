import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Switch } from "../../components/Bits";
import { BlockedNotice } from "../../components/BlockedNotice";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { COVER_PRESETS } from "../../data/seed";
import {
  dublinDateKey,
  dublinTimeKey,
  dublinToIso,
  formatLongDate,
  formatMoney,
  formatTimeRange,
} from "../../domain/format";
import { canPublish, checkEventTimes, type RuleResult } from "../../domain/rules";
import { CATEGORIES, type Category } from "../../domain/types";
import { useStore } from "../../state/store";
import { NotFound } from "../NotFound";

/**
 * Event editor (FR 26–FR 29). A Draft created from a Confirmed booking:
 * details, ticket types, and Publish with the EX2/EX3 guards.
 */
export function EventEditor() {
  const { eventId } = useParams();
  const { db, userId, updateEvent, addTicketType, removeTicketType, publishEvent, toast } = useStore();
  const event = db.events.find((e) => e.id === eventId && e.organiserId === userId);
  useDocumentTitle(event ? `Edit ${event.title || "draft event"}` : "Event not found");

  const booking = event && db.bookings.find((b) => b.id === event.bookingId);
  const [startTime, setStartTime] = useState(event ? dublinTimeKey(event.startsAt) : "19:00");
  const [endTime, setEndTime] = useState(event ? dublinTimeKey(event.endsAt) : "23:00");
  const [timeError, setTimeError] = useState<RuleResult | null>(null);
  const [tt, setTt] = useState({ name: "", description: "", price: "", quantity: "", max: "4" });
  const [ttError, setTtError] = useState<RuleResult | null>(null);
  const [publishError, setPublishError] = useState<RuleResult | null>(null);
  const publishNoticeRef = useRef<HTMLDivElement>(null);
  const ttNameRef = useRef<HTMLInputElement>(null);

  if (!event || !booking) return <NotFound what="event" />;
  const venue = db.venues.find((v) => v.id === event.venueId)!;
  const ticketTypes = db.ticketTypes.filter((t) => t.eventId === event.id);
  const isDraft = event.status === "Draft";
  const publishCheck = canPublish(event, booking, db.ticketTypes);
  const bookingDate = dublinDateKey(booking.startsAt);

  const applyTimes = (start: string, end: string) => {
    const next = { startsAt: dublinToIso(bookingDate, start), endsAt: dublinToIso(bookingDate, end) };
    const check = checkEventTimes(next, booking);
    if (!check.ok) {
      setTimeError(check);
      return;
    }
    setTimeError(null);
    updateEvent(event.id, next);
  };

  const onAddTicketType = (e: FormEvent) => {
    e.preventDefault();
    const result = addTicketType(event.id, {
      name: tt.name,
      description: tt.description,
      priceCents: Math.round(Number(tt.price || "0") * 100),
      quantityTotal: Number(tt.quantity),
      maxPerOrder: Number(tt.max),
    });
    if (!result.ok) {
      setTtError(result);
      return;
    }
    setTtError(null);
    setPublishError(null);
    setTt({ name: "", description: "", price: "", quantity: "", max: "4" });
    toast(`Ticket type "${tt.name.trim()}" added.`);
    ttNameRef.current?.focus();
  };

  const onPublish = () => {
    const result = publishEvent(event.id);
    if (!result.ok) {
      setPublishError(result);
      requestAnimationFrame(() => publishNoticeRef.current?.focus());
      return;
    }
    setPublishError(null);
    toast(`${event.title} is published and on the map.`);
  };

  const shownBlock = publishError && !publishError.ok ? publishError : !publishCheck.ok ? publishCheck : null;

  return (
    <section className="page">
      <Link className="back-link" to="/organiser/events">
        <Icon name="back" size={16} /> My events
      </Link>
      <p className="eyebrow">{isDraft ? "Draft event" : "Event"}</p>
      <h1 className="page-title">{event.title || "Untitled draft"}</h1>
      <p className="status-line">
        <StatusPill status={event.status} label="Event status" />
        <span className="muted">
          {venue.name} · booked {formatLongDate(booking.startsAt)}, {formatTimeRange(booking.startsAt, booking.endsAt)}
        </span>
      </p>

      {!isDraft ? (
        <div className="publish-success" data-testid="publish-success">
          <Icon name="check" size={22} />
          <div>
            <h2>It&rsquo;s live.</h2>
            <p>
              {event.title} is Published: it&rsquo;s on the map and in search, and tickets are on sale.
            </p>
            <p className="link-row">
              <Link className="btn btn-ink" to="/">
                See it on the map
              </Link>
              <Link className="btn btn-ghost" to={`/events/${event.id}`}>
                View the event page
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      <div className="detail-grid editor-grid">
        <div>
          <section className="form-card" aria-labelledby="details-heading">
            <h2 id="details-heading">Details</h2>
            <fieldset disabled={!isDraft} className="plain-fieldset">
              <div className="field">
                <label htmlFor="ev-title">Title</label>
                <input
                  id="ev-title"
                  value={event.title}
                  placeholder="e.g. Liberties Winter Supper Club"
                  onChange={(e) => updateEvent(event.id, { title: e.target.value })}
                />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="ev-category">Category</label>
                  <select
                    id="ev-category"
                    value={event.category}
                    onChange={(e) => updateEvent(event.id, { category: e.target.value as Category })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="field-label" id="ev-date-label">
                    Date
                  </span>
                  <p className="readonly-value" aria-labelledby="ev-date-label">
                    {formatLongDate(booking.startsAt)}
                  </p>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="ev-start">Starts</label>
                  <input
                    id="ev-start"
                    type="time"
                    value={startTime}
                    aria-describedby="time-hint"
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      applyTimes(e.target.value, endTime);
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ev-end">Ends</label>
                  <input
                    id="ev-end"
                    type="time"
                    value={endTime}
                    aria-describedby="time-hint"
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      applyTimes(startTime, e.target.value);
                    }}
                  />
                </div>
              </div>
              <p id="time-hint" className="muted small">
                Must fall inside your booking ({formatTimeRange(booking.startsAt, booking.endsAt)}). The location
                comes from the venue.
              </p>
              {timeError && !timeError.ok ? (
                <BlockedNotice id="time-error" code={timeError.code} title={timeError.title}>
                  {timeError.reason}
                </BlockedNotice>
              ) : null}
              <div className="field">
                <label htmlFor="ev-description">Description</label>
                <textarea
                  id="ev-description"
                  rows={4}
                  value={event.description}
                  onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                />
              </div>
              <fieldset className="cover-picker">
                <legend className="field-label">Cover image</legend>
                <div className="cover-options">
                  {COVER_PRESETS.map((img) => (
                    <label key={img.url} className="cover-option">
                      <input
                        type="radio"
                        name="cover"
                        checked={event.coverImage.url === img.url}
                        onChange={() => updateEvent(event.id, { coverImage: img })}
                      />
                      <img src={img.url} alt="" />
                      <span className="sr-only">{img.alt}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Switch
                id="ev-solo"
                checked={event.welcomingSolo}
                onChange={(v) => updateEvent(event.id, { welcomingSolo: v })}
                label="Welcoming if you're coming on your own"
                hint="Shown as a filter on What's on."
              />
            </fieldset>
          </section>

          <section className="form-card" aria-labelledby="tt-heading">
            <h2 id="tt-heading">Ticket types</h2>
            {ticketTypes.length ? (
              <table className="data-table">
                <caption className="sr-only">Ticket types for this event</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Price</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Max per order</th>
                    {isDraft ? (
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.map((t) => (
                    <tr key={t.id}>
                      <th scope="row">
                        {t.name}
                        {t.description ? <small>{t.description}</small> : null}
                      </th>
                      <td>{t.priceCents ? formatMoney(t.priceCents, { exact: true }) : "Free"}</td>
                      <td>{t.quantityTotal}</td>
                      <td>{t.maxPerOrder}</td>
                      {isDraft ? (
                        <td>
                          <button type="button" className="text-button" onClick={() => removeTicketType(t.id)}>
                            Remove<span className="sr-only"> {t.name}</span>
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No ticket types yet.</p>
            )}

            {isDraft ? (
              <form className="tt-form" onSubmit={onAddTicketType} aria-labelledby="tt-add-heading" noValidate>
                <h3 id="tt-add-heading" className="small-heading">
                  Add a ticket type
                </h3>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="tt-name">Name</label>
                    <input
                      id="tt-name"
                      ref={ttNameRef}
                      value={tt.name}
                      placeholder="General admission"
                      onChange={(e) => setTt({ ...tt, name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="tt-price">Price (€)</label>
                    <input
                      id="tt-price"
                      type="number"
                      min={0}
                      step="0.5"
                      inputMode="decimal"
                      value={tt.price}
                      placeholder="0 for free"
                      onChange={(e) => setTt({ ...tt, price: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="tt-qty">Quantity</label>
                    <input
                      id="tt-qty"
                      type="number"
                      min={1}
                      value={tt.quantity}
                      onChange={(e) => setTt({ ...tt, quantity: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="tt-max">Max per order</label>
                    <input
                      id="tt-max"
                      type="number"
                      min={1}
                      value={tt.max}
                      onChange={(e) => setTt({ ...tt, max: e.target.value })}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="tt-desc">Description (optional)</label>
                  <input
                    id="tt-desc"
                    value={tt.description}
                    onChange={(e) => setTt({ ...tt, description: e.target.value })}
                  />
                </div>
                {ttError && !ttError.ok ? (
                  <BlockedNotice id="tt-error" code={ttError.code} title={ttError.title}>
                    {ttError.reason}
                  </BlockedNotice>
                ) : null}
                <button type="submit" className="btn btn-ink">
                  <Icon name="plus" size={16} /> Add ticket type
                </button>
              </form>
            ) : null}
          </section>
        </div>

        <aside className="action-panel" aria-labelledby="publish-heading">
          <h2 id="publish-heading">Publish</h2>
          <ul className="checklist">
            <li className={booking.status === "Confirmed" ? "ok" : "no"}>
              <Icon name={booking.status === "Confirmed" ? "check" : "close"} size={16} />
              Booking is Confirmed <span className="rule-tag">EX2</span>
            </li>
            <li className={event.title.trim() ? "ok" : "no"}>
              <Icon name={event.title.trim() ? "check" : "close"} size={16} /> Event has a title
            </li>
            <li className={!timeError ? "ok" : "no"}>
              <Icon name={!timeError ? "check" : "close"} size={16} /> Times inside the booking
            </li>
            <li className={ticketTypes.length ? "ok" : "no"}>
              <Icon name={ticketTypes.length ? "check" : "close"} size={16} />
              At least one ticket type <span className="rule-tag">EX3</span>
            </li>
          </ul>
          {isDraft ? (
            <>
              <button
                type="button"
                className="btn btn-primary full"
                aria-disabled={!publishCheck.ok}
                aria-describedby={shownBlock ? "publish-blocked" : undefined}
                onClick={() => (publishCheck.ok ? onPublish() : publishNoticeRef.current?.focus())}
              >
                Publish event
              </button>
              {shownBlock && !shownBlock.ok ? (
                <BlockedNotice ref={publishNoticeRef} id="publish-blocked" code={shownBlock.code} title={shownBlock.title}>
                  {shownBlock.reason}
                </BlockedNotice>
              ) : null}
              <p className="muted small">
                Publishing puts the event on the map and in search and opens ticket sales.
              </p>
            </>
          ) : (
            <p className="muted small">
              Published events can&rsquo;t be unpublished once tickets are sold (EX4). Editing after publishing is out of
              scope for this prototype.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
