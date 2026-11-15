import { useId, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface MapPin {
  id: string;
  x: number;
  y: number;
  /** Short visible text, e.g. "€22" (as in the export). */
  text: string;
  /** Full accessible name, e.g. "The Corner House Sessions, Sat 21 Nov, from €22". */
  label: string;
}

const ZOOMS = [1, 1.25, 1.5];

/**
 * The export's illustrated map, kept instead of Mapbox (DECISIONS D-007).
 * Pins sit at each venue's % position. Zoom scales the illustration and spreads
 * the pins out from the centre.
 */
export function MapPanel({
  title = "Explore the map",
  pins,
  selectedId,
  onSelect,
  detail,
  compact = false,
  interactive = true,
}: {
  title?: string;
  pins: MapPin[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  detail?: ReactNode;
  compact?: boolean;
  interactive?: boolean;
}) {
  const headingId = useId();
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = ZOOMS[zoomIndex];
  const place = (x: number, y: number) => ({
    left: `${50 + (x - 50) * zoom}%`,
    top: `${45 + (y - 45) * zoom}%`,
  });

  return (
    <section className={`map-panel ${compact ? "compact" : ""}`} aria-labelledby={headingId}>
      <div className="map-top">
        <h2 id={headingId}>
          <Icon name="location" size={16} /> {title}
        </h2>
        <button
          type="button"
          aria-label="Zoom out"
          aria-disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
        >
          <Icon name="minus" size={16} />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          aria-disabled={zoomIndex === ZOOMS.length - 1}
          onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      <div className="map-art">
        <div className="map-layer" style={{ transform: `scale(${zoom})` }} aria-hidden="true">
          <span className="river" />
          <span className="road r1" />
          <span className="road r2" />
          <span className="road r3" />
          <span className="road r4" />
          <span className="road r5" />
          <span className="park p1" />
          <span className="park p2" />
          <span className="map-label l1">DRUMCONDRA</span>
          <span className="map-label l2">SMITHFIELD</span>
          <span className="map-label l3">RINGSEND</span>
          <span className="map-label l4">PHIBSBOROUGH</span>
        </div>
        {interactive ? (
          <ul className="map-pins" aria-label={`Map pins (${pins.length})`}>
            {pins.map((pin) => (
              <li key={pin.id}>
                <button
                  type="button"
                  className="map-pin"
                  style={place(pin.x, pin.y)}
                  aria-label={pin.label}
                  aria-pressed={selectedId === pin.id}
                  onClick={() => onSelect?.(pin.id)}
                >
                  {pin.text}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          pins.map((pin) => (
            <span key={pin.id} className="map-pin" style={place(pin.x, pin.y)} role="img" aria-label={pin.label}>
              {pin.text}
            </span>
          ))
        )}
        {detail ? (
          <div className="map-detail-region" aria-live="polite">
            {detail}
          </div>
        ) : null}
      </div>
    </section>
  );
}
