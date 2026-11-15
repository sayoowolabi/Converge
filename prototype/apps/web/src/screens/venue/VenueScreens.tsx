import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BookingTimeline, DefinitionGrid, DemoNote } from "../../components/Bits";
import { BlockedNotice } from "../../components/BlockedNotice";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { formatDay, formatDistance, formatLongDate, formatMoney, formatTimeRange } from "../../domain/format";
import { canApprove, clashingBookings, pendingOverlaps, type RuleResult } from "../../domain/rules";
import type { Booking, BookingStatus } from "../../domain/types";
import { packagePrice } from "../../domain/venues";
import { useStore } from "../../state/store";
import { NotFound } from "../NotFound";

function useMyVenues() {
  const { db, userId } = useStore();
  return db.venues.filter((v) => v.memberIds.includes(userId));
}

/** Venue operator: incoming requests grouped by state (FR 20). */
export function VenueHome() {
  useDocumentTitle("Booking requests");
  const { db, userId } = useStore();
  const venues = useMyVenues();
  const ids = venues.map((v) => v.id);
  const all = db.bookings
    .filter((b) => ids.includes(b.venueId))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const groups: { title: string; statuses: BookingStatus[]; empty: string }[] = [
    { title: "Needs a decision", statuses: ["Pending"], empty: "No pending requests." },
    { title: "Approved: waiting for deposit", statuses: ["Approved"], empty: "Nothing waiting for a deposit." },
    { title: "Confirmed", statuses: ["Confirmed"], empty: "No confirmed bookings yet." },
    { title: "Closed", statuses: ["Rejected", "Cancelled", "Expired", "Completed"], empty: "Nothing closed yet." },
  ];
  return (
    <section className="page">
      <p className="eyebrow">Venue operator · {venues.length} venues</p>
      <h1 className="page-title">Booking requests</h1>
      <DemoNote>
        Demo: your account manages these venues and also organises events, so your own requests appear here too
        (FR 4).
      </DemoNote>
      {groups.map((g) => {
        const rows = all.filter((b) => g.statuses.includes(b.status));
        const headingId = `group-${g.statuses[0]}`;
        return (
          <section key={g.title} className="info-section" aria-labelledby={headingId}>
            <h2 id={headingId}>
              {g.title} <span className="count">{rows.length}</span>
            </h2>
            {rows.length ? (
              <ul className="row-list">
                {rows.map((b) => (
                  <RequestRow key={b.id} booking={b} mine={b.organiserId === userId} />
                ))}
              </ul>
            ) : (
              <p className="muted">{g.empty}</p>
            )}
          </section>
        );
      })}
    </section>
  );
}

function RequestRow({ booking, mine }: { booking: Booking; mine: boolean }) {
  const { db } = useStore();
  const venue = db.venues.find((v) => v.id === booking.venueId)!;
  const organiser = db.users.find((u) => u.id === booking.organiserId)!;
  const clash = booking.status === "Pending" && clashingBookings(booking, db.bookings).length > 0;
  return (
    <li className="row-card" data-testid="request-row">
      <div>
        <p className="event-date">
          {formatDay(booking.startsAt)} · {formatTimeRange(booking.startsAt, booking.endsAt)}
        </p>
        <h3>
          <Link to={`/venue/bookings/${booking.id}`}>
            {organiser.organisation ?? organiser.name}
            {mine ? " (you)" : ""}
          </Link>
        </h3>
        <p className="muted small">
          {venue.name} · {booking.expectedGuests} guests
        </p>
      </div>
      <div className="row-tags">
        {clash ? <span className="clash-tag">Clashes</span> : null}
        <StatusPill status={booking.status} label="Booking status" />
      </div>
    </li>
  );
}

/** Review one request: clash list, approve (BT2/BX2) or decline with a reason (BT3). */
export function BookingReview() {
  useDocumentTitle("Review booking request");
  const { bookingId } = useParams();
  const { db, userId, approveBooking, declineBooking, setRole, toast } = useStore();
  const navigate = useNavigate();
  const [reason, setReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<RuleResult | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const booking = db.bookings.find((b) => b.id === bookingId);
  const venue = booking && db.venues.find((v) => v.id === booking.venueId);
  if (!booking || !venue || !venue.memberIds.includes(userId)) return <NotFound what="booking request" />;
  const organiser = db.users.find((u) => u.id === booking.organiserId)!;
  const pkg = venue.packages.find((p) => p.id === booking.packageId);
  const clashes = clashingBookings(booking, db.bookings);
  const pendingClashes = pendingOverlaps(booking, db.bookings);
  const approveCheck = canApprove(booking, db.bookings, userId, venue);
  const mine = booking.organiserId === userId;

  const fail = (r: RuleResult) => {
    setError(r);
    requestAnimationFrame(() => noticeRef.current?.focus());
  };
  const approve = () => {
    const r = approveBooking(booking.id);
    if (!r.ok) return fail(r);
    setError(null);
    toast(`Approved. ${venue.name} is held for ${formatDay(booking.startsAt)} until the deposit is paid.`);
  };
  const decline = (e: FormEvent) => {
    e.preventDefault();
    const r = declineBooking(booking.id, reason);
    if (!r.ok) return fail(r);
    setError(null);
    toast("Request declined. The organiser has been told why.");
  };
  const describe = (b: Booking) => {
    const who = db.users.find((u) => u.id === b.organiserId)!;
    return `${who.organisation ?? who.name}, ${formatTimeRange(b.startsAt, b.endsAt)}`;
  };

  return (
    <section className="page">
      <Link className="back-link" to="/venue">
        <Icon name="back" size={16} /> Requests
      </Link>
      <p className="eyebrow">{venue.name}</p>
      <h1 className="page-title">
        {organiser.organisation ?? organiser.name}
        {mine ? " (you)" : ""}
      </h1>
      <p className="status-line">
        <StatusPill status={booking.status} label="Booking status" />
        <span className="muted">
          {formatLongDate(booking.startsAt)}, {formatTimeRange(booking.startsAt, booking.endsAt)}
        </span>
      </p>

      <div className="detail-grid">
        <div>
          <BookingTimeline booking={booking} />
          <DefinitionGrid
            items={[
              ["Organiser", `${organiser.name}${organiser.organisation ? ` · ${organiser.organisation}` : ""}`],
              ["Package", pkg ? `${pkg.name} (${packagePrice(pkg)})` : "None"],
              ["Expected guests", booking.expectedGuests],
              ["Estimated value", formatMoney(booking.quotedPriceCents)],
              ["Deposit", booking.depositCents ? formatMoney(booking.depositCents) : "None"],
              ["Message", booking.message || "(none)"],
            ]}
          />
          <section className="info-section" aria-labelledby="clash-heading">
            <h2 id="clash-heading">Clashing bookings</h2>
            {clashes.length === 0 && pendingClashes.length === 0 ? (
              <p className="muted">Nothing else overlaps this time.</p>
            ) : (
              <ul className="plain-list clash-list">
                {clashes.map((b) => (
                  <li key={b.id}>
                    <StatusPill status={b.status} /> {describe(b)}{" "}
                    <Link to={`/venue/bookings/${b.id}`}>View</Link>
                  </li>
                ))}
                {pendingClashes.map((b) => (
                  <li key={b.id}>
                    <StatusPill status={b.status} /> {describe(b)}{" "}
                    <Link to={`/venue/bookings/${b.id}`}>View</Link>
                  </li>
                ))}
              </ul>
            )}
            {pendingClashes.length && booking.status === "Pending" ? (
              <p className="muted small">
                Overlapping Pending requests are allowed, but only one of them can be approved.
              </p>
            ) : null}
          </section>
        </div>

        <div className="action-panel">
          <h2>Decision</h2>
          {booking.status === "Pending" ? (
            <>
              <button
                type="button"
                className="btn btn-primary full"
                aria-disabled={!approveCheck.ok}
                aria-describedby={!approveCheck.ok ? "approve-blocked" : undefined}
                onClick={() => (approveCheck.ok ? approve() : noticeRef.current?.focus())}
              >
                <Icon name="check" size={18} /> Approve and hold the date
              </button>
              {!approveCheck.ok ? (
                <BlockedNotice ref={noticeRef} id="approve-blocked" code={approveCheck.code} title={approveCheck.title}>
                  {approveCheck.reason}
                </BlockedNotice>
              ) : null}
              {!declining ? (
                <button type="button" className="btn btn-ghost full" onClick={() => setDeclining(true)}>
                  Decline…
                </button>
              ) : (
                <form onSubmit={decline} className="decline-form" noValidate>
                  <div className="field">
                    <label htmlFor="decline-reason">Reason for declining (sent to the organiser)</label>
                    <textarea
                      id="decline-reason"
                      rows={3}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-ink full">
                    Decline request
                  </button>
                </form>
              )}
              {error && !error.ok ? (
                <BlockedNotice id="review-error" code={error.code} title={error.title}>
                  {error.reason}
                </BlockedNotice>
              ) : null}
            </>
          ) : (
            <p>This request is {booking.status}. No further decision is needed.</p>
          )}
          {mine && booking.status === "Approved" ? (
            <>
              <DemoNote>This is your own request. Switch back to the Organiser view to pay the deposit.</DemoNote>
              <button
                type="button"
                className="btn btn-ink full"
                onClick={() => {
                  setRole("organiser");
                  navigate(`/organiser/bookings/${booking.id}`);
                }}
              >
                Switch to Organiser view <Icon name="arrow" size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Venue operator: the listings they manage, with packages and availability (FR 9–FR 12, summary only). */
export function VenueListings() {
  useDocumentTitle("My venues");
  const { db } = useStore();
  const venues = useMyVenues();
  if (!venues.length) {
    return (
      <EmptyState title="No venues yet">
        <p>Creating a listing is out of scope for this prototype.</p>
      </EmptyState>
    );
  }
  return (
    <section className="page">
      <p className="eyebrow">Venue operator</p>
      <h1 className="page-title">My venues</h1>
      <ul className="venue-results listings">
        {venues.map((v) => {
          const stop = db.stops.find((s) => s.id === v.nearestStopId)!;
          const upcoming = db.bookings.filter(
            (b) => b.venueId === v.id && (b.status === "Approved" || b.status === "Confirmed"),
          ).length;
          return (
            <li key={v.id}>
              <article className="venue-card">
                <img src={v.photos[0].url} alt={v.photos[0].alt} loading="lazy" />
                <div className="venue-card-body">
                  <h2>
                    <Link to={`/venues/${v.id}`}>{v.name}</Link>
                  </h2>
                  <p className="muted small">
                    {v.address} · <StatusPill status="Published" label="Listing status" />
                  </p>
                  <ul className="venue-facts">
                    <li>
                      <Icon name="users" size={15} /> {v.capacityStanding} standing · {v.capacitySeated} seated
                    </li>
                    <li>
                      <Icon name="train" size={15} /> {stop.mode} {stop.name}, {formatDistance(v.nearestStopM)}
                    </li>
                    <li>
                      <Icon name="ticket" size={15} /> {v.packages.length} package{v.packages.length === 1 ? "" : "s"} ·{" "}
                      {upcoming} held date{upcoming === 1 ? "" : "s"}
                    </li>
                    <li>
                      <Icon name="calendar" size={15} /> Tue–Sun, 12 noon–11.30 pm until 31 Jan 2027
                    </li>
                  </ul>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Editing listings, availability and staff (FR 9–FR 14) is outside this prototype&rsquo;s journeys.
      </p>
    </section>
  );
}
