import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { EventCard } from "../../components/EventCard";
import { EmptyState, useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { MapPanel } from "../../components/MapPanel";
import { DEMO_NOW, dublinDateKey, formatDay, formatMoney } from "../../domain/format";
import type { Category, Db } from "../../domain/types";
import { useStore, type EventView } from "../../state/store";

type Chip = "all" | "weekend" | "saved" | Category;
type When = "any" | "weekend" | "week" | "month";
type Area = "all" | "city" | "south";

const CHIPS: { id: Chip; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "weekend", label: "This weekend" },
  { id: "Trad & folk", label: "Trad & folk" },
  { id: "Food & drink", label: "Food & drink" },
  { id: "Arts & culture", label: "Arts & culture" },
  { id: "saved", label: "Saved" },
];

const PRICE_MAX = 80; // slider top = "€80+" = no limit

/** Saturday 00:00 to Monday 00:00 (Dublin) of the demo week. */
function weekendRange(): [string, string] {
  const d = new Date(DEMO_NOW);
  const toSat = (6 - d.getUTCDay() + 7) % 7;
  const sat = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + toSat));
  const mon = new Date(sat.getTime() + 2 * 86400_000);
  return [dublinDateKey(sat), dublinDateKey(mon)];
}

function buildViews(db: Db): EventView[] {
  return db.events
    .filter((e) => (e.status === "Published" || e.status === "Sold Out") && new Date(e.endsAt) > DEMO_NOW)
    .map((event) => {
      const venue = db.venues.find((v) => v.id === event.venueId)!;
      const stop = db.stops.find((s) => s.id === venue.nearestStopId)!;
      const organiser = db.users.find((u) => u.id === event.organiserId)!;
      const ticketTypes = db.ticketTypes.filter((t) => t.eventId === event.id);
      return {
        event,
        venue,
        stop,
        organiser,
        ticketTypes,
        going: ticketTypes.reduce((n, t) => n + t.quantitySold, 0),
        fromCents: ticketTypes.length ? Math.min(...ticketTypes.map((t) => t.priceCents)) : 0,
      };
    })
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

export function WhatsOn() {
  useDocumentTitle("What’s on");
  const { db, toggleSave, toast } = useStore();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<Area>("all");
  const [when, setWhen] = useState<When>("any");
  const [chip, setChip] = useState<Chip>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
  const [soloOnly, setSoloOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const resultsRef = useRef<HTMLHeadingElement>(null);

  const all = useMemo(() => buildViews(db), [db]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const [wkStart, wkEnd] = weekendRange();
    const nowKey = dublinDateKey(DEMO_NOW);
    const inDays = (iso: string, days: number) =>
      new Date(iso).getTime() - DEMO_NOW.getTime() <= days * 86400_000;
    const inWeekend = (iso: string) => {
      const k = dublinDateKey(iso);
      return k >= wkStart && k < wkEnd;
    };
    return all.filter(({ event, venue, fromCents }) => {
      if (q) {
        const hay = `${event.title} ${event.description} ${venue.name} ${venue.area} ${event.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (area === "city" && venue.eircodeRoutingKey === "A96") return false;
      if (area === "south" && venue.eircodeRoutingKey !== "A96") return false;
      if (when === "weekend" && !inWeekend(event.startsAt)) return false;
      if (when === "week" && !inDays(event.startsAt, 7)) return false;
      if (when === "month" && !inDays(event.startsAt, 30)) return false;
      if (dublinDateKey(event.startsAt) < nowKey) return false;
      if (chip === "weekend" && !inWeekend(event.startsAt)) return false;
      if (chip === "saved" && !db.savedEventIds.includes(event.id)) return false;
      if (chip !== "all" && chip !== "weekend" && chip !== "saved" && event.category !== chip) return false;
      if (maxPrice < PRICE_MAX && fromCents > maxPrice * 100) return false;
      if (soloOnly && !event.welcomingSolo) return false;
      return true;
    });
  }, [all, query, area, when, chip, maxPrice, soloOnly, db.savedEventIds]);

  const selected = results.find((r) => r.event.id === selectedId) ?? results[0];
  const drawerCount = (maxPrice < PRICE_MAX ? 1 : 0) + (soloOnly ? 1 : 0);

  const focusResults = () => {
    resultsRef.current?.scrollIntoView({ block: "start" });
    resultsRef.current?.focus({ preventScroll: true });
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    focusResults();
  };
  const onSave = (view: EventView) => {
    const nowSaved = toggleSave(view.event.id);
    toast(nowSaved ? `Saved ${view.event.title}.` : `Removed ${view.event.title} from saved events.`);
  };

  return (
    <>
      <section className="intro">
        <div>
          <p className="eyebrow">Dublin, together</p>
          <h1>
            Find something
            <br />
            <em>worth going to.</em>
          </h1>
        </div>
        <p className="intro-copy">
          Good nights out, neighbourhood favourites and a few unexpected finds. See who&rsquo;s going, make a plan and
          feel part of it.
        </p>
      </section>

      <form className="search-panel on-dark" role="search" aria-label="Search events" onSubmit={onSearch}>
        <div className="search-field">
          <span>
            <Icon name="search" />
          </span>
          <div className="field-stack">
            <label htmlFor="q">What</label>
            <input
              id="q"
              type="search"
              value={query}
              placeholder="Search events, artists or venues"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="search-field">
          <span>
            <Icon name="location" />
          </span>
          <div className="field-stack">
            <label htmlFor="where">Where</label>
            <select id="where" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              <option value="all">Dublin &amp; nearby</option>
              <option value="city">Dublin city</option>
              <option value="south">Dún Laoghaire &amp; the coast</option>
            </select>
          </div>
        </div>
        <div className="search-field date-field">
          <span>
            <Icon name="calendar" />
          </span>
          <div className="field-stack">
            <label htmlFor="when">When</label>
            <select id="when" value={when} onChange={(e) => setWhen(e.target.value as When)}>
              <option value="any">Any date</option>
              <option value="weekend">This weekend</option>
              <option value="week">Next 7 days</option>
              <option value="month">Next 30 days</option>
            </select>
          </div>
        </div>
        <button type="submit" className="search-submit">
          <Icon name="arrow" />
          <span>See what&rsquo;s on</span>
        </button>
      </form>

      <div className="content-head">
        <div>
          <p className="eyebrow">Picks near you</p>
          <h2 id="results-heading" ref={resultsRef} tabIndex={-1}>
            What&rsquo;s on around Dublin
          </h2>
        </div>
        <p className="distance" aria-live="polite">
          <span data-testid="result-count">
            {results.length} local event{results.length === 1 ? "" : "s"}
          </span>
          <i aria-hidden="true" />
          from {formatDay(DEMO_NOW.toISOString())}
        </p>
      </div>

      <div className="filters" role="group" aria-label="Quick filters">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" aria-pressed={chip === c.id} onClick={() => setChip(c.id)}>
            {c.label}
            {c.id === "saved" ? ` (${db.savedEventIds.length})` : ""}
          </button>
        ))}
        <button
          type="button"
          className="filter-button"
          aria-expanded={drawerOpen}
          aria-controls="filter-drawer"
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <Icon name="sliders" size={17} /> Filters
          {drawerCount ? (
            <b>
              {drawerCount}
              <span className="sr-only"> active</span>
            </b>
          ) : null}
        </button>
      </div>

      {drawerOpen ? (
        <div className="filter-drawer" id="filter-drawer">
          <div>
            <label className="drawer-label" htmlFor="max-price">
              Maximum price
            </label>
            <div className="price-range">
              <span aria-hidden="true">€0</span>
              <input
                id="max-price"
                type="range"
                min={0}
                max={PRICE_MAX}
                step={5}
                value={maxPrice}
                aria-valuetext={maxPrice >= PRICE_MAX ? "Any price" : `Up to ${formatMoney(maxPrice * 100)}`}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              />
              <output htmlFor="max-price">{maxPrice >= PRICE_MAX ? "Any price" : `Up to €${maxPrice}`}</output>
            </div>
          </div>
          <div className="switch-row">
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={soloOnly}
              aria-labelledby="solo-label"
              onClick={() => setSoloOnly(!soloOnly)}
            >
              <i />
            </button>
            <span id="solo-label">Welcoming if you&rsquo;re coming on your own</span>
          </div>
          <button
            type="button"
            className="apply-filter"
            onClick={() => {
              setDrawerOpen(false);
              focusResults();
            }}
          >
            Show {results.length} event{results.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}

      <div className="explore-grid">
        {results.length === 0 ? (
          <EmptyState title="Nothing matches those filters">
            <p>Try another date or category, or clear your search.</p>
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                setQuery("");
                setArea("all");
                setWhen("any");
                setChip("all");
                setMaxPrice(PRICE_MAX);
                setSoloOnly(false);
              }}
            >
              Clear all filters
            </button>
          </EmptyState>
        ) : (
          <ul className="event-list" aria-labelledby="results-heading">
            {results.map((view) => (
              <li key={view.event.id}>
                <EventCard
                  view={view}
                  selected={selected?.event.id === view.event.id}
                  saved={db.savedEventIds.includes(view.event.id)}
                  onToggleSave={() => onSave(view)}
                />
              </li>
            ))}
          </ul>
        )}

        <MapPanel
          pins={results.map(({ event, venue, fromCents }) => ({
            id: event.id,
            x: venue.map.x,
            y: venue.map.y,
            text: event.status === "Sold Out" ? "Sold out" : formatMoney(fromCents),
            label: `${event.title}, ${formatDay(event.startsAt)}, ${
              event.status === "Sold Out" ? "sold out" : `from ${formatMoney(fromCents)}`
            }`,
          }))}
          selectedId={selected?.event.id}
          onSelect={setSelectedId}
          detail={
            selected ? (
              <div className="map-detail">
                <img src={selected.event.coverImage.url} alt="" />
                <div>
                  <small>{formatDay(selected.event.startsAt)}</small>
                  <strong>{selected.event.title}</strong>
                  <span>{selected.venue.name}</span>
                </div>
                <Link className="map-go" to={`/events/${selected.event.id}`} aria-label={`View ${selected.event.title}`}>
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
            ) : null
          }
        />
      </div>

      <section className="solo-banner" aria-labelledby="solo-heading">
        <div className="solo-avatars" aria-hidden="true">
          <span>J</span>
          <span>N</span>
          <span>R</span>
        </div>
        <div>
          <p className="eyebrow">Coming on your own?</p>
          <h2 id="solo-heading">You&rsquo;ll be in good company.</h2>
          <p>Say hello in the event chat beforehand, or simply turn up. No pressure either way.</p>
        </div>
        <button
          type="button"
          className="on-dark"
          onClick={() => {
            setSoloOnly(true);
            setChip("all");
            toast("Showing events that are welcoming if you're coming on your own.");
            focusResults();
          }}
        >
          Find a welcoming event <Icon name="arrow" size={18} />
        </button>
      </section>
    </>
  );
}
