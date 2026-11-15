import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BookingTimeline, DefinitionGrid, DemoNote } from "../../components/Bits";
import { BlockedNotice } from "../../components/BlockedNotice";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { formatLongDate, formatMoney, formatTimeRange } from "../../domain/format";
import { canCreateEvent, type RuleResult } from "../../domain/rules";
import { useStore } from "../../state/store";
import { NotFound } from "../NotFound";

/** Organiser's view of one booking: status, deposit (BT6) and "create event" (ET1/EX1). */
export function BookingDetail() {
  useDocumentTitle("Booking");
  const { bookingId } = useParams();
  const { db, userId, setRole, confirmBooking, createEventFromBooking, toast } = useStore();
  const navigate = useNavigate();
  const [error, setError] = useState<RuleResult | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const booking = db.bookings.find((b) => b.id === bookingId && b.organiserId === userId);
  if (!booking) return <NotFound what="booking" />;
  const venue = db.venues.find((v) => v.id === booking.venueId)!;
  const pkg = venue.packages.find((p) => p.id === booking.packageId);
  const event = db.events.find((e) => e.bookingId === booking.id);
  const createCheck = canCreateEvent(booking, db.events, userId);

  const fail = (r: RuleResult) => {
    setError(r);
    requestAnimationFrame(() => noticeRef.current?.focus());
  };

  const payDeposit = () => {
    const r = confirmBooking(booking.id);
    if (!r.ok) return fail(r);
    setError(null);
    toast("Deposit paid (test mode). Your booking is Confirmed.");
  };

  const createEvent = () => {
    const r = createEventFromBooking(booking.id);
    if (!r.ok) return fail(r);
    toast("Draft event created from your booking.");
    navigate(`/organiser/events/${r.id}`);
  };

  return (
    <section className="page">
      <Link className="back-link" to="/organiser">
        <Icon name="back" size={16} /> Dashboard
      </Link>
      <p className="eyebrow">Booking request</p>
      <h1 className="page-title">{venue.name}</h1>
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
              ["Package", pkg ? pkg.name : "None"],
              ["Expected guests", booking.expectedGuests],
              ["Estimated cost", formatMoney(booking.quotedPriceCents)],
              ["Deposit", booking.depositCents ? formatMoney(booking.depositCents) : "None"],
              ["Your message", booking.message || "(none)"],
            ]}
          />
        </div>

        <div className="action-panel">
          <h2>Next step</h2>
          {booking.status === "Pending" ? (
            <>
              <p>The venue has been notified. Venues have 72 hours to respond before a request expires.</p>
              <DemoNote>
                In this demo your account also manages {venue.name}. Switch to the Venue operator view to approve
                the request yourself.
              </DemoNote>
              <button
                type="button"
                className="btn btn-ink full"
                onClick={() => {
                  setRole("venue_operator");
                  navigate(`/venue/bookings/${booking.id}`);
                }}
              >
                Switch to Venue operator view <Icon name="arrow" size={16} />
              </button>
            </>
          ) : null}
          {booking.status === "Approved" ? (
            <>
              <p>
                {venue.name} approved your request. Pay the deposit to confirm the booking and lock the date.
              </p>
              <dl className="price-breakdown compact">
                <div>
                  <dt>Deposit due now</dt>
                  <dd>{booking.depositCents ? formatMoney(booking.depositCents, { exact: true }) : "None"}</dd>
                </div>
                <div>
                  <dt>Balance due to venue</dt>
                  <dd>{formatMoney(Math.max(0, booking.quotedPriceCents - booking.depositCents), { exact: true })}</dd>
                </div>
              </dl>
              <button type="button" className="checkout-button" onClick={payDeposit}>
                <Icon name="lock" />{" "}
                {booking.depositCents
                  ? `Pay ${formatMoney(booking.depositCents, { exact: true })} deposit · test mode`
                  : "Confirm booking"}
              </button>
              <p className="test-mode-note">
                <Icon name="info" size={16} /> No card details are collected. The real system takes the deposit
                through Stripe in test mode.
              </p>
            </>
          ) : null}
          {booking.status === "Confirmed" && !event ? <p>Your date is locked. Create your event from this booking.</p> : null}
          {booking.status === "Rejected" ? <p>The venue declined this request: {booking.declineReason}</p> : null}

          {event ? (
            <p>
              Event: <Link to={`/organiser/events/${event.id}`}>{event.title || "Untitled draft"}</Link>{" "}
              <StatusPill status={event.status} label="Event status" />
            </p>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary full"
                aria-disabled={!createCheck.ok}
                aria-describedby={!createCheck.ok ? "create-rule" : undefined}
                onClick={() => (createCheck.ok ? createEvent() : noticeRef.current?.focus())}
              >
                <Icon name="plus" size={18} /> Create event from this booking
              </button>
              {!createCheck.ok ? (
                <BlockedNotice ref={noticeRef} id="create-rule" code={createCheck.code} title={createCheck.title}>
                  {createCheck.reason}
                </BlockedNotice>
              ) : null}
            </>
          )}
          {error && !error.ok && createCheck.ok ? (
            <BlockedNotice ref={noticeRef} id="booking-error" code={error.code} title={error.title}>
              {error.reason}
            </BlockedNotice>
          ) : null}
        </div>
      </div>
    </section>
  );
}
