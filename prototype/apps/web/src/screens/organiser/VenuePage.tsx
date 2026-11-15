import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { BlockedNotice } from "../../components/BlockedNotice";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { MapPanel } from "../../components/MapPanel";
import { ROLE_LABEL } from "../../components/TopBar";
import {
  dublinToIso,
  formatDay,
  formatDistance,
  formatMoney,
  formatTimeRange,
  walkMinutes,
} from "../../domain/format";
import type { RuleResult } from "../../domain/rules";
import { estimateCost, packagePrice, PRICING_LABEL } from "../../domain/venues";
import { useStore } from "../../state/store";
import { NotFound } from "../NotFound";

/** Venue page (FR 16) with the booking request form (FR 19, BT1). */
export function VenuePage() {
  const { venueId } = useParams();
  const [params] = useSearchParams();
  const { db, role, setRole, requestBooking, logInteraction, toast } = useStore();
  const navigate = useNavigate();
  const venue = db.venues.find((v) => v.id === venueId);
  useDocumentTitle(venue?.name ?? "Venue not found");

  const [date, setDate] = useState(params.get("date") ?? "2026-12-12");
  const [from, setFrom] = useState(params.get("from") ?? "19:00");
  const [to, setTo] = useState(params.get("to") ?? "23:00");
  const [guests, setGuests] = useState(Number(params.get("guests") ?? 60));
  const [packageId, setPackageId] = useState(venue?.packages[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<RuleResult | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (venueId) logInteraction("venue_view", { venueId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  if (!venue || !venue.listed) return <NotFound what="venue" />;
  const stop = db.stops.find((s) => s.id === venue.nearestStopId)!;
  const pkg = venue.packages.find((p) => p.id === packageId);
  const held = db.bookings
    .filter((b) => b.venueId === venue.id && (b.status === "Approved" || b.status === "Confirmed"))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = requestBooking({
      venueId: venue.id,
      packageId: packageId || undefined,
      startsAt: dublinToIso(date, from),
      endsAt: dublinToIso(date, to),
      expectedGuests: guests,
      message,
    });
    if (!result.ok) {
      setError(result);
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    toast("Booking requested. It's Pending until the venue responds.");
    navigate(`/organiser/bookings/${result.id}`);
  };

  return (
    <article className="page venue-page">
      <Link className="back-link" to="/organiser/venues">
        <Icon name="back" size={16} /> Find a venue
      </Link>
      <div className="event-hero">
        <div className="event-hero-image">
          <img src={venue.photos[0].url} alt={venue.photos[0].alt} />
        </div>
        <div className="event-hero-body">
          <p className="eyebrow">{venue.area}</p>
          <h1 className="display-title">{venue.name}</h1>
          <p className="lede">{venue.description}</p>
          <p className="hero-meta">
            <span>
              <Icon name="users" size={16} /> {venue.capacityStanding} standing · {venue.capacitySeated} seated
            </span>
            <span>
              <Icon name="location" size={16} /> {venue.address}, {venue.eircodeRoutingKey}
            </span>
          </p>
          <div className="stop-card">
            <span className="stop-icon" aria-hidden="true">
              <Icon name="train" size={20} />
            </span>
            <div>
              <p className="eyebrow">Nearest stop</p>
              <p className="stop-name">
                {stop.mode}
                {stop.line ? ` ${stop.line}` : ""} · {stop.name}
              </p>
              <p className="muted">
                {formatDistance(venue.nearestStopM)}, about {walkMinutes(venue.nearestStopM)} min walk
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="event-columns">
        <div>
          <section className="info-section" aria-labelledby="facilities-heading">
            <h2 id="facilities-heading">Facilities</h2>
            <ul className="tag-list">
              {venue.facilities.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>

          <section className="info-section" aria-labelledby="packages-heading">
            <h2 id="packages-heading">Packages and prices</h2>
            <table className="data-table">
              <caption className="sr-only">Packages, prices and deposits</caption>
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Price</th>
                  <th scope="col">Deposit</th>
                  <th scope="col">Guests</th>
                </tr>
              </thead>
              <tbody>
                {venue.packages.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      {p.name}
                      <small>
                        {PRICING_LABEL[p.model]} · {p.inclusions.join(", ")}
                      </small>
                    </th>
                    <td>{packagePrice(p)}</td>
                    <td>{p.depositCents ? formatMoney(p.depositCents) : "None"}</td>
                    <td>
                      {p.minGuests}–{p.maxGuests}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="info-section" aria-labelledby="availability-heading">
            <h2 id="availability-heading">Availability</h2>
            <p>
              Open for bookings Tuesday to Sunday, 12 noon to 11.30 pm, from 19 November 2026 to 31 January 2027.
              Closed on Mondays.
            </p>
            {held.length ? (
              <>
                <h3 className="small-heading">Already booked</h3>
                <ul className="plain-list held-list">
                  {held.map((b) => (
                    <li key={b.id}>
                      {formatDay(b.startsAt)}, {formatTimeRange(b.startsAt, b.endsAt)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <MapPanel
            title="Venue location"
            compact
            interactive={false}
            pins={[{ id: venue.id, x: venue.map.x, y: venue.map.y, text: venue.name, label: `${venue.name} on the map` }]}
          />
        </div>

        <aside className="getting-there booking-panel" aria-labelledby="request-heading">
          <h2 id="request-heading">Request a booking</h2>
          {role !== "organiser" ? (
            <BlockedNotice id="role-needed" code="ROLE" title="Organiser view needed" tone="info">
              <p>
                You&rsquo;re viewing as {ROLE_LABEL[role]}. Booking requests are made from the Organiser view.
              </p>
              <button type="button" className="btn btn-ink" onClick={() => setRole("organiser")}>
                Switch to Organiser view
              </button>
            </BlockedNotice>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="field">
                <label htmlFor="bk-date">Date</label>
                <input id="bk-date" type="date" min="2026-11-19" max="2027-01-31" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="bk-from">From</label>
                  <input id="bk-from" type="time" required value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="bk-to">Until</label>
                  <input id="bk-to" type="time" required value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="bk-package">Package</label>
                <select id="bk-package" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                  {venue.packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({packagePrice(p)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bk-guests">Expected guests</label>
                <input
                  id="bk-guests"
                  type="number"
                  min={1}
                  required
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value) || 0)}
                />
              </div>
              <div className="field">
                <label htmlFor="bk-message">Message to the venue</label>
                <textarea
                  id="bk-message"
                  rows={3}
                  value={message}
                  placeholder="Layout, equipment, catering…"
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {pkg ? (
                <dl className="price-breakdown compact">
                  <div>
                    <dt>Estimated cost</dt>
                    <dd>{formatMoney(estimateCost(pkg, guests))}</dd>
                  </div>
                  <div>
                    <dt>Deposit to confirm</dt>
                    <dd>{pkg.depositCents ? formatMoney(pkg.depositCents) : "None"}</dd>
                  </div>
                </dl>
              ) : null}
              {error && !error.ok ? (
                <BlockedNotice ref={noticeRef} id="request-error" code={error.code} title={error.title}>
                  {error.reason}
                </BlockedNotice>
              ) : null}
              <button type="submit" className="btn btn-primary full" aria-describedby={error && !error.ok ? "request-error" : undefined}>
                Send booking request
              </button>
              <p className="muted small">
                Nothing is charged now. The request is <strong>Pending</strong> until the venue approves it; you then
                pay the deposit to confirm.
              </p>
            </form>
          )}
        </aside>
      </div>
    </article>
  );
}
