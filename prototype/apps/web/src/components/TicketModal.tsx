import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { formatDay, formatMoney, formatTime } from "../domain/format";
import { remaining, type RuleResult } from "../domain/rules";
import { useStore, type EventView } from "../state/store";
import { BlockedNotice } from "./BlockedNotice";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

/** The export's ticket modal, made an accessible dialog with real ticket types (FR 28, FR 46, D-017). */
export function TicketModal({ view, onClose }: { view: EventView; onClose: () => void }) {
  const { reserveTickets, toast } = useStore();
  const navigate = useNavigate();
  const { event, venue, ticketTypes } = view;
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const first = ticketTypes.find((t) => remaining(t) > 0);
    return first ? { [first.id]: 1 } : {};
  });
  const [error, setError] = useState<RuleResult | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const total = ticketTypes.reduce((n, t) => n + (qty[t.id] ?? 0) * t.priceCents, 0);
  const count = Object.values(qty).reduce((n, q) => n + q, 0);
  const titleId = `ticket-modal-title-${event.id}`;

  const change = (id: string, delta: number, max: number) => {
    setError(null);
    setQty((q) => ({ ...q, [id]: Math.min(max, Math.max(0, (q[id] ?? 0) + delta)) }));
  };

  const checkout = () => {
    const result = reserveTickets(event.id, qty);
    if (!result.ok) {
      setError(result);
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    toast("Tickets reserved. They're held for 10 minutes while you pay.");
    onClose();
    navigate(`/checkout/${result.id}`);
  };

  return (
    <Dialog labelledBy={titleId} onClose={onClose} className="ticket-modal">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close ticket selection">
        <Icon name="close" />
      </button>
      <img src={event.coverImage.url} alt="" />
      <div className="modal-body">
        <p className="eyebrow">
          {event.category} · {formatDay(event.startsAt)} · {formatTime(event.startsAt)}
        </p>
        <h2 id={titleId}>{event.title}</h2>
        <p className="modal-place">
          <Icon name="location" size={17} /> {venue.name}, {venue.area}
        </p>
        <p className="modal-description">{event.description}</p>

        <fieldset className="ticket-fieldset">
          <legend className="drawer-label">Choose tickets</legend>
          {ticketTypes.map((t) => {
            const left = remaining(t);
            const max = Math.min(t.maxPerOrder, left);
            const value = qty[t.id] ?? 0;
            const atMax = value >= max;
            const hintId = `hint-${t.id}`;
            return (
              <div key={t.id} className={`ticket-option ${left === 0 ? "unavailable" : ""}`}>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </div>
                <b>{t.priceCents === 0 ? "Free" : formatMoney(t.priceCents)}</b>
                <div className="counter">
                  <span id={hintId} className={`stock ${left > 0 && left <= 10 ? "low" : ""}`}>
                    {left === 0
                      ? "Sold out"
                      : `${left <= 10 ? `Only ${left} left` : `${left} left`} · max ${t.maxPerOrder} per order`}
                  </span>
                  <div className="counter-controls">
                    <button
                      type="button"
                      aria-label={`Remove one ${t.name} ticket`}
                      aria-disabled={value === 0}
                      onClick={() => value > 0 && change(t.id, -1, max)}
                    >
                      <Icon name="minus" size={15} />
                    </button>
                    <output aria-live="polite" aria-label={`${t.name} tickets`}>
                      {value}
                    </output>
                    <button
                      type="button"
                      aria-label={`Add one ${t.name} ticket`}
                      aria-disabled={atMax}
                      aria-describedby={hintId}
                      onClick={() => !atMax && change(t.id, 1, max)}
                    >
                      <Icon name="plus" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </fieldset>

        <div className="modal-total">
          <span>
            Total{count > 0 ? ` · ${count} ticket${count > 1 ? "s" : ""}` : ""}
          </span>
          <strong data-testid="modal-total">{formatMoney(total, { exact: true })}</strong>
        </div>
        {error && !error.ok ? (
          <BlockedNotice ref={noticeRef} id="ticket-modal-error" code={error.code} title={error.title}>
            {error.reason}
          </BlockedNotice>
        ) : null}
        <button
          type="button"
          className="checkout-button"
          onClick={checkout}
          aria-disabled={count === 0}
          aria-describedby={error && !error.ok ? "ticket-modal-error" : undefined}
        >
          <Icon name="ticket" /> Continue to checkout
        </button>
        <p className="secure-note">Price includes booking fees · Test-mode checkout · Instant digital tickets</p>
      </div>
    </Dialog>
  );
}
