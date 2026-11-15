import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { BlockedNotice } from "../../components/BlockedNotice";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { countdown, formatDayTime, formatMoney } from "../../domain/format";
import type { RuleResult } from "../../domain/rules";
import { useStore } from "../../state/store";
import { NotFound } from "../NotFound";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

/**
 * Mock checkout. Tickets are Reserved for 10 minutes (TT1) and become Paid on
 * success (TT2). The full price breakdown is shown before paying (FR 47).
 * No card details are collected (NFR 8); the real system hands off to Stripe in test mode.
 */
export function Checkout() {
  useDocumentTitle("Checkout");
  const { orderId } = useParams();
  const { db, payOrder, releaseOrder, toast } = useStore();
  const navigate = useNavigate();
  const order = db.orders.find((o) => o.id === orderId);
  const now = useNow(order?.status === "Reserved");
  const [error, setError] = useState<RuleResult | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const warnedRef = useRef(false);

  const msLeft = order ? order.holdExpiresAtMs - now : 0;
  useEffect(() => {
    if (order?.status === "Reserved" && msLeft < 60_000 && msLeft > 0 && !warnedRef.current) {
      warnedRef.current = true;
      toast("Less than a minute left on your ticket hold.");
    }
  }, [msLeft, order?.status, toast]);

  if (!order) return <NotFound what="order" />;
  const event = db.events.find((e) => e.id === order.eventId)!;
  const venue = db.venues.find((v) => v.id === event.venueId)!;
  const lines = order.lines.map((l) => ({ ...l, type: db.ticketTypes.find((t) => t.id === l.ticketTypeId)! }));
  const qty = lines.reduce((n, l) => n + l.quantity, 0);

  const pay = () => {
    const result = payOrder(order.id);
    if (!result.ok) {
      setError(result);
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    toast("Payment successful (test mode). Your tickets are ready.");
    navigate("/tickets", { state: { highlightOrderId: order.id } });
  };

  return (
    <section className="page checkout-page">
      <Link className="back-link" to={`/events/${event.id}`}>
        <Icon name="back" size={16} /> {event.title}
      </Link>
      <p className="eyebrow">Checkout</p>
      <h1 className="page-title">Review and pay</h1>

      {order.status === "Released" ? (
        <BlockedNotice id="hold-ended" code="TT3" title="Your hold has ended">
          <p>
            Tickets are held for 10 minutes while you pay. This hold ended or was cancelled, so the tickets went back
            on sale. You haven&rsquo;t been charged.
          </p>
          <Link className="btn btn-ink" to={`/events/${event.id}`}>
            Choose tickets again
          </Link>
        </BlockedNotice>
      ) : null}
      {order.status === "Paid" ? (
        <BlockedNotice id="paid" code="TT2" title="Already paid" tone="info">
          <p>This order is paid. Your tickets are waiting in My tickets.</p>
          <Link className="btn btn-ink" to="/tickets">
            Go to My tickets
          </Link>
        </BlockedNotice>
      ) : null}

      <div className="checkout-grid">
        <div className="checkout-summary">
          <div className="summary-event">
            <img src={event.coverImage.url} alt="" />
            <div>
              <p className="event-date">{formatDayTime(event.startsAt)}</p>
              <h2>{event.title}</h2>
              <p className="muted">
                {venue.name}, {venue.area}
              </p>
            </div>
          </div>
          <table className="data-table">
            <caption className="sr-only">Tickets in this order</caption>
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Qty</th>
                <th scope="col">Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.ticketTypeId}>
                  <th scope="row">{l.type.name}</th>
                  <td>{l.quantity}</td>
                  <td>{formatMoney(l.unitPriceCents * l.quantity, { exact: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Order status: <StatusPill status={order.status === "Released" ? "Released" : order.status} />
          </p>
        </div>

        <div className="checkout-pay">
          {order.status === "Reserved" ? (
            <div className="hold-timer" data-testid="hold-timer">
              <Icon name="lock" size={18} />
              <p>
                <strong>
                  {qty} ticket{qty > 1 ? "s" : ""} held for you
                </strong>{" "}
                <span className="sr-only">Time left: </span>
                <span className="timer" aria-hidden="false">
                  {countdown(msLeft)}
                </span>
                <span className="muted"> · Reserved until you pay</span>
              </p>
            </div>
          ) : null}

          <h2 className="breakdown-title">Price breakdown</h2>
          <dl className="price-breakdown">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotalCents, { exact: true })}</dd>
            </div>
            <div>
              <dt>Promo discount</dt>
              <dd>{order.discountCents ? `−${formatMoney(order.discountCents, { exact: true })}` : "None"}</dd>
            </div>
            <div>
              <dt>Booking fee</dt>
              <dd>Included</dd>
            </div>
            <div className="total">
              <dt>Total to pay</dt>
              <dd data-testid="checkout-total">{formatMoney(order.totalCents, { exact: true })}</dd>
            </div>
          </dl>

          {error && !error.ok ? (
            <BlockedNotice ref={noticeRef} id="pay-error" code={error.code} title={error.title}>
              {error.reason}
            </BlockedNotice>
          ) : null}

          {order.status === "Reserved" ? (
            <>
              <button type="button" className="checkout-button" onClick={pay}>
                <Icon name="lock" /> Pay {formatMoney(order.totalCents, { exact: true })} · test mode
              </button>
              <p className="test-mode-note">
                <Icon name="info" size={16} /> Prototype checkout: no card details are collected or stored. In the
                real system, payment is handled by Stripe in test mode and Converge keeps only the payment reference.
              </p>
              <div className="checkout-secondary">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    releaseOrder(order.id, "cancelled");
                    navigate(`/events/${event.id}`);
                  }}
                >
                  Cancel and release tickets
                </button>
                <button type="button" className="text-button demo-control" onClick={() => releaseOrder(order.id, "expired")}>
                  Demo: let the hold expire now
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
