import type { BookingStatus, EventStatus, TicketStatus } from "../domain/types";

type AnyStatus = BookingStatus | EventStatus | TicketStatus;

const tone: Record<AnyStatus, string> = {
  Pending: "pending",
  Approved: "approved",
  Confirmed: "confirmed",
  Rejected: "negative",
  Cancelled: "negative",
  Expired: "neutral",
  Completed: "neutral",
  Draft: "pending",
  Published: "confirmed",
  "Sold Out": "negative",
  Reserved: "pending",
  Paid: "confirmed",
  "Checked In": "approved",
  Released: "neutral",
  Refunded: "neutral",
  "No Show": "neutral",
};

/** State shown as text (never colour alone), using the state-table names. */
export function StatusPill({ status, label }: { status: AnyStatus; label?: string }) {
  return (
    <span className={`status-pill status-${tone[status]}`}>
      {label ? <span className="sr-only">{label}: </span> : null}
      {status}
    </span>
  );
}
