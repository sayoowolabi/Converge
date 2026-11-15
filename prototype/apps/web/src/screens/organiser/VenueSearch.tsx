import { useMemo, useState } from "react";
import { Link } from "react-router";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { MapPanel } from "../../components/MapPanel";
import { dublinToIso, formatDistance, formatMoney, haversineM, walkMinutes } from "../../domain/format";
import { maxCapacity, priceGuide, SEARCH_POINTS, slotStatus } from "../../domain/venues";
import { useStore } from "../../state/store";

const FACILITY_FILTERS = ["Step-free access", "Projector & screen", "Bar"];

/**
 * Venue search (FR 15): guests, date and time slot, distance from a point,
 * budget and facilities. Results show distance, capacity, price guide and the
 * nearest public-transport stop.
 */
export function VenueSearch() {
  useDocumentTitle("Find a venue");
  const { db } = useStore();
  const [guests, setGuests] = useState(60);
  const [date, setDate] = useState("2026-12-12");
  const [from, setFrom] = useState("19:00");
  const [to, setTo] = useState("23:00");
  const [pointId, setPointId] = useState<string>("centre");
  const [radiusKm, setRadiusKm] = useState(5);
  const [budget, setBudget] = useState(0);
  const [facilities, setFacilities] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const point = SEARCH_POINTS.find((p) => p.id === pointId)!;
  const startsAt = date && from ? dublinToIso(date, from) : "";
  const endsAt = date && to ? dublinToIso(date, to) : "";

  const results = useMemo(() => {
    return db.venues
      .filter((v) => v.listed)
      .map((venue) => {
        const distanceM = haversineM(point, venue);
        const guide = priceGuide(venue, guests);
        const slot = startsAt && endsAt ? slotStatus(venue, startsAt, endsAt, db.bookings) : "available";
        const stop = db.stops.find((s) => s.id === venue.nearestStopId)!;
        return { venue, distanceM, guide, slot, stop };
      })
      .filter((r) => maxCapacity(r.venue) >= guests)
      .filter((r) => r.distanceM <= radiusKm * 1000)
      .filter((r) => !budget || (r.guide && r.guide.cost <= budget * 100))
      .filter((r) => facilities.every((f) => r.venue.facilities.some((vf) => vf.includes(f.split(" ")[0]))))
      .sort((a, b) => (a.slot === "available" ? 0 : 1) - (b.slot === "available" ? 0 : 1) || a.distanceM - b.distanceM);
  }, [db, guests, startsAt, endsAt, point, radiusKm, budget, facilities]);

  const selected = results.find((r) => r.venue.id === selectedId) ?? results[0];
  const query = new URLSearchParams({ date, from, to, guests: String(guests) }).toString();

  return (
    <section className="page">
      <p className="eyebrow">Organiser · Find a venue</p>
      <h1 className="page-title">Find a room that fits</h1>

      <form className="venue-filters" aria-label="Venue search filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="vs-guests">Guests</label>
          <input
            id="vs-guests"
            type="number"
            min={1}
            max={500}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="field">
          <label htmlFor="vs-date">Date</label>
          <input id="vs-date" type="date" min="2026-11-19" max="2027-01-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vs-from">From</label>
          <input id="vs-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vs-to">Until</label>
          <input id="vs-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vs-point">Near</label>
          <select id="vs-point" value={pointId} onChange={(e) => setPointId(e.target.value)}>
            {SEARCH_POINTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="vs-radius">Within</label>
          <select id="vs-radius" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
            <option value={1}>1 km</option>
            <option value={2}>2 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="vs-budget">Budget</label>
          <select id="vs-budget" value={budget} onChange={(e) => setBudget(Number(e.target.value))}>
            <option value={0}>Any budget</option>
            <option value={300}>Up to €300</option>
            <option value={500}>Up to €500</option>
            <option value={1000}>Up to €1,000</option>
          </select>
        </div>
        <fieldset className="field facility-field">
          <legend>Must have</legend>
          {FACILITY_FILTERS.map((f) => (
            <label key={f} className="check">
              <input
                type="checkbox"
                checked={facilities.includes(f)}
                onChange={(e) =>
                  setFacilities((cur) => (e.target.checked ? [...cur, f] : cur.filter((x) => x !== f)))
                }
              />
              {f}
            </label>
          ))}
        </fieldset>
      </form>

      <p className="result-summary" aria-live="polite">
        <strong data-testid="venue-count">
          {results.length} venue{results.length === 1 ? "" : "s"}
        </strong>{" "}
        for {guests} guests within {radiusKm} km of {point.label}
      </p>

      <div className="explore-grid">
        {results.length === 0 ? (
          <EmptyState title="No venues match">
            <p>Try fewer guests, a wider distance or a bigger budget.</p>
          </EmptyState>
        ) : (
          <ul className="venue-results" aria-label="Venue results">
            {results.map(({ venue, distanceM, guide, slot, stop }) => (
              <li key={venue.id}>
                <article
                  className={`venue-card ${selected?.venue.id === venue.id ? "selected" : ""}`}
                  data-testid="venue-card"
                >
                  <img src={venue.photos[0].url} alt={venue.photos[0].alt} loading="lazy" />
                  <div className="venue-card-body">
                    <h2>
                      <Link to={`/venues/${venue.id}?${query}`}>{venue.name}</Link>
                    </h2>
                    <p className="muted small">
                      {venue.area} · {formatDistance(distanceM)} away
                    </p>
                    <ul className="venue-facts">
                      <li>
                        <Icon name="users" size={15} /> {venue.capacityStanding} standing · {venue.capacitySeated} seated
                      </li>
                      <li>
                        <Icon name="train" size={15} /> {stop.mode} {stop.name}, {formatDistance(venue.nearestStopM)} (
                        {walkMinutes(venue.nearestStopM)} min walk)
                      </li>
                      <li>
                        <Icon name="ticket" size={15} />{" "}
                        {guide ? `From ${formatMoney(guide.cost)} · ${guide.pkg.name}` : "No package for this group size"}
                      </li>
                    </ul>
                    <p className={`slot slot-${slot}`}>
                      {slot === "available"
                        ? "Available for your time"
                        : slot === "booked"
                          ? "Already booked at that time"
                          : "Closed at that time"}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}

        <MapPanel
          title="Venues on the map"
          pins={results.map(({ venue, guide }) => ({
            id: venue.id,
            x: venue.map.x,
            y: venue.map.y,
            text: guide ? formatMoney(guide.cost) : venue.name,
            label: `${venue.name}${guide ? `, from ${formatMoney(guide.cost)}` : ""}`,
          }))}
          selectedId={selected?.venue.id}
          onSelect={setSelectedId}
          detail={
            selected ? (
              <div className="map-detail">
                <img src={selected.venue.photos[0].url} alt="" />
                <div>
                  <small>{formatDistance(selected.distanceM)} away</small>
                  <strong>{selected.venue.name}</strong>
                  <span>
                    {selected.stop.mode} {selected.stop.name} · {formatDistance(selected.venue.nearestStopM)}
                  </span>
                </div>
                <Link className="map-go" to={`/venues/${selected.venue.id}?${query}`} aria-label={`View ${selected.venue.name}`}>
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
            ) : null
          }
        />
      </div>
    </section>
  );
}
