import type { ReactNode } from "react";
import type { Booking, BookingStatus } from "../domain/types";
import { formatDayTime } from "../domain/format";
import { Icon } from "./Icon";

/** Booking progress Pending → Approved → Confirmed (BST), with timestamps from history. */
export function BookingTimeline({ booking }: { booking: Booking }) {
  const steps: { status: BookingStatus; text: string }[] = [
    { status: "Pending", text: "Requested" },
    { status: "Approved", text: "Approved by venue" },
    { status: "Confirmed", text: "Deposit paid" },
  ];
  const order: BookingStatus[] = ["Pending", "Approved", "Confirmed", "Completed"];
  const reached = order.indexOf(booking.status);
  const ended = !order.includes(booking.status);
  return (
    <ol className="timeline" aria-label="Booking progress">
      {steps.map((s, i) => {
        const entry = booking.history.find((h) => h.status === s.status);
        const done = !!entry && (ended || i <= reached);
        const current = !ended && i === reached;
        return (
          <li key={s.status} className={`${done ? "done" : ""} ${current ? "current" : ""}`}>
            <span className="dot" aria-hidden="true">
              {done ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span>
              <strong>{s.status}</strong>
              <small>
                {s.text}
                {entry ? ` · ${formatDayTime(entry.at)}` : ""}
                {current ? <span className="sr-only"> (current step)</span> : null}
              </small>
            </span>
          </li>
        );
      })}
      {ended ? (
        <li className="ended">
          <span className="dot" aria-hidden="true">
            <Icon name="close" size={14} />
          </span>
          <span>
            <strong>{booking.status}</strong>
            {booking.declineReason ? <small>Reason: {booking.declineReason}</small> : null}
          </span>
        </li>
      ) : null}
    </ol>
  );
}

export function DefinitionGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="def-grid">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="demo-note">
      <Icon name="info" size={16} />
      <span>{children}</span>
    </p>
  );
}

/** Accessible on/off switch with a visible label. */
export function Switch({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="switch-field">
      <button
        type="button"
        id={id}
        className="switch"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
      <span>
        <span id={`${id}-label`} className="switch-label">
          {label}
        </span>
        {hint ? (
          <small id={`${id}-hint`} className="muted">
            {hint}
          </small>
        ) : null}
      </span>
    </div>
  );
}
