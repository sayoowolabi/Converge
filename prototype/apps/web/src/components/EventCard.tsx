import { Link } from "react-router";
import { formatDayTime, formatMoney } from "../domain/format";
import type { EventView } from "../state/store";
import { Icon } from "./Icon";

/**
 * Event card from the export. The title is a real link stretched over the card,
 * so the card works with a keyboard; the save button stays a separate button (D-015).
 */
export function EventCard({
  view,
  saved,
  selected,
  onToggleSave,
}: {
  view: EventView;
  saved: boolean;
  selected?: boolean;
  onToggleSave: () => void;
}) {
  const { event, venue, going, fromCents } = view;
  const soldOut = event.status === "Sold Out";
  return (
    <article className={`event-card ${selected ? "selected" : ""}`} data-testid="event-card">
      <div className="event-image-wrap">
        <img src={event.coverImage.url} alt={event.coverImage.alt} className="event-image" loading="lazy" />
        <span className="category-pill">{event.category}</span>
        {soldOut ? <span className="status-flag">Sold out</span> : null}
        <button
          type="button"
          className="save-button"
          aria-pressed={saved}
          aria-label={`Save ${event.title}`}
          onClick={onToggleSave}
        >
          <Icon name="heart" size={18} filled={saved} />
        </button>
        <div className="people-pill">
          <span className="avatar-stack" aria-hidden="true">
            JN
          </span>
          {going} going
        </div>
      </div>
      <div className="event-content">
        <div>
          <p className="event-date">{formatDayTime(event.startsAt)}</p>
          <h3>
            <Link to={`/events/${event.id}`}>{event.title}</Link>
          </h3>
          <p className="event-place">
            {venue.name} <span aria-hidden="true">·</span> {venue.area}
          </p>
        </div>
        <div className="event-price">
          <small>{soldOut ? "SOLD OUT" : "FROM"}</small>
          {formatMoney(fromCents)}
        </div>
      </div>
    </article>
  );
}
