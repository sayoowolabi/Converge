import { useMemo, useState } from "react";
import { Link } from "react-router";
import { forecastEvent, upcomingFromDb, type Forecast } from "../../analytics/forecast";
import { getHistory, HISTORY_ORGANISERS } from "../../analytics/history";
import { MAX_INSIGHTS, MIN_GROUP, organiserInsights, venueInsights, type Insight } from "../../analytics/insights";
import {
  barByInterval,
  barPerAttendee,
  getPeriod,
  monthlyOccupancy,
  monthlyRevenue,
  organiserKpis,
  PERIODS,
  scopeHistory,
  ticketTypeSellThrough,
  venueKpis,
  weeklySales,
  type PeriodId,
} from "../../analytics/metrics";
import { ChartCard, ColumnChart, Meter, PaceChart, SegmentBar, StatTile } from "../../components/charts/Charts";
import { useDocumentTitle } from "../../components/Feedback";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { formatDay, formatMoney } from "../../domain/format";
import { useStore } from "../../state/store";

/* ------------------------------------------------------------------ Shared pieces */

const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number) => new Intl.NumberFormat("en-IE").format(Math.round(x));
const euro = (cents: number) => formatMoney(Math.round(cents / 100) * 100);
const euroAxis = (v: number) =>
  v >= 100_000 ? `€${(v / 100_000).toFixed(v % 100_000 ? 1 : 0)}K` : `€${Math.round(v / 100)}`;
const monthLabel = (m: string) =>
  new Intl.DateTimeFormat("en-IE", { month: "short", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
const weekLabel = (w: string) =>
  new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${w}T12:00:00Z`));

function delta(cur: number, prev: number | undefined, kind: "relative" | "points", vs: string | undefined) {
  if (prev === undefined || vs === undefined) return undefined;
  const diff = kind === "relative" ? (prev ? cur / prev - 1 : 0) : (cur - prev) * 100;
  const direction: "up" | "down" | "flat" = Math.abs(diff) < (kind === "relative" ? 0.005 : 0.5) ? "flat" : diff > 0 ? "up" : "down";
  const text = kind === "relative" ? `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff * 100))}%` : `${diff >= 0 ? "+" : "−"}${Math.abs(Math.round(diff))} pts`;
  return { text, direction, vs };
}

function PeriodFilter({ value, onChange }: { value: PeriodId; onChange: (p: PeriodId) => void }) {
  return (
    <fieldset className="period-filter">
      <legend className="sr-only">Period</legend>
      {PERIODS.map((p) => (
        <label key={p.id} className="chip-radio">
          <input type="radio" name="period" value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} />
          <span>{p.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function InsightsPanel({ insights, scopeNote }: { insights: Insight[]; scopeNote: string }) {
  return (
    <section className="insights" aria-labelledby="insights-heading" data-testid="insights">
      <header className="insights-head">
        <div>
          <p className="eyebrow">Insights</p>
          <h2 id="insights-heading">What the numbers are saying</h2>
        </div>
        <span className="synthetic-badge">Synthetic demo data</span>
      </header>
      <p className="insights-sub">
        Found by statistical comparisons on your events ({scopeNote}) and written from templates, so every figure traces
        back to a calculation. No external AI service is used. Groups need at least {MIN_GROUP} events; up to{" "}
        {MAX_INSIGHTS} are shown, strongest first.
      </p>
      {insights.length === 0 ? (
        <p className="insight-empty">
          <Icon name="info" size={18} /> Not enough events in this period to say anything reliable. Try a longer period.
        </p>
      ) : (
        <ol className="insight-list">
          {insights.map((i) => (
            <li key={i.id} className={`insight insight-${i.kind}`} data-testid="insight">
              <p className="insight-text">{i.text}</p>
              <details>
                <summary>How this was worked out</summary>
                <p className="insight-method">{i.method}</p>
                <dl className="insight-evidence">
                  {i.evidence.map((e) => (
                    <div key={e.label}>
                      <dt>{e.label}</dt>
                      <dd>{e.value}</dd>
                    </div>
                  ))}
                </dl>
                {i.note ? <p className="insight-note">{i.note}</p> : null}
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Organiser */

/** Organiser analytics (FR 67, FR 70, FR 71). */
export function OrganiserAnalytics() {
  useDocumentTitle("Analytics");
  const { db, userId } = useStore();
  const [periodId, setPeriodId] = useState<PeriodId>("ytd");
  const history = getHistory();
  const period = getPeriod(periodId);

  const upcoming = useMemo(() => upcomingFromDb(db, userId), [db, userId]);
  const forecasts = useMemo(() => upcoming.map((u) => forecastEvent(u, history.events)), [upcoming, history]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = forecasts.find((f) => f.event.id === selectedId) ?? forecasts.find((f) => f.status === "below") ?? forecasts[0];

  const view = useMemo(() => {
    const scope = scopeHistory(history, { start: period.start, end: period.end, organiserId: userId });
    const prev = period.previous
      ? scopeHistory(history, { start: period.previous.start, end: period.previous.end, organiserId: userId })
      : undefined;
    const curves = [
      ...history.events
        .filter((e) => e.organiserId === userId)
        .map((e) => ({ date: e.date, cumulative: e.cumulative, firstDay: 0 })),
      ...upcoming.map((u) => ({ date: u.date, cumulative: u.cumulative, firstDay: u.daysOut })),
    ];
    return {
      events: scope.events,
      kpis: organiserKpis(scope.events),
      prevKpis: prev ? organiserKpis(prev.events) : undefined,
      weekly: weeklySales(curves, period.start, period.end),
      monthly: monthlyRevenue(scope.events, period.start, period.end),
      types: ticketTypeSellThrough(scope.events),
      insights: organiserInsights(scope.events, forecasts),
    };
  }, [history, period.start, period.end, period.previous, userId, upcoming, forecasts]);

  const { kpis, prevKpis } = view;
  const vs = period.previous?.label;
  const org = HISTORY_ORGANISERS[userId];

  return (
    <section className="page analytics-page">
      <p className="eyebrow">Organiser · {org}</p>
      <h1 className="page-title">Analytics</h1>

      <div className="filter-row" role="group" aria-label="Filters for every figure on this page">
        <PeriodFilter value={periodId} onChange={setPeriodId} />
        <p className="filter-note">
          {formatDay(`${period.start}T12:00:00Z`)} – {formatDay(`${period.end}T12:00:00Z`)} · {kpis.events} events
        </p>
      </div>

      <div className="stat-row">
        <StatTile hero label="Tickets sold" value={num(kpis.sold)} delta={delta(kpis.sold, prevKpis?.sold, "relative", vs)} />
        <StatTile label="Ticket revenue" value={euro(kpis.revenueCents)} delta={delta(kpis.revenueCents, prevKpis?.revenueCents, "relative", vs)} />
        <StatTile label="Sell-through" value={pct(kpis.sellThrough)} delta={delta(kpis.sellThrough, prevKpis?.sellThrough, "points", vs)} />
        <StatTile label="Attendance (checked in ÷ sold)" value={pct(kpis.attendance)} delta={delta(kpis.attendance, prevKpis?.attendance, "points", vs)} />
      </div>

      <InsightsPanel insights={view.insights} scopeNote={period.label.toLowerCase()} />

      <div className="chart-grid">
        <ChartCard
          title="Tickets sold per week"
          subtitle="By purchase date, including events still on sale"
          table={{
            caption: "Tickets sold per week",
            columns: ["Week starting", "Tickets sold"],
            rows: view.weekly.map((w) => [weekLabel(w.week), w.value]),
          }}
        >
          <ColumnChart
            ariaLabel="Tickets sold per week"
            yFormat={(v) => num(v)}
            data={view.weekly.map((w) => ({
              key: w.week,
              label: weekLabel(w.week),
              value: w.value,
              display: `${num(w.value)} tickets`,
              detail: `week of ${weekLabel(w.week)}`,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Ticket revenue by month"
          subtitle="By event date"
          table={{
            caption: "Ticket revenue by month",
            columns: ["Month", "Revenue"],
            rows: view.monthly.map((m) => [monthLabel(m.month), euro(m.value)]),
          }}
        >
          <ColumnChart
            ariaLabel="Ticket revenue by month"
            yFormat={euroAxis}
            data={view.monthly.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.value, display: euro(m.value) }))}
          />
        </ChartCard>
      </div>

      <ForecastSection forecasts={forecasts} selected={selected} onSelect={setSelectedId} />

      <div className="chart-grid">
        <section className="chart-card" aria-labelledby="types-heading">
          <header className="chart-card-head">
            <div>
              <h3 id="types-heading">Sell-through by ticket type</h3>
              <p className="chart-sub">Share of each ticket type sold, {period.label.toLowerCase()}</p>
            </div>
          </header>
          <ul className="meter-list">
            {view.types.map((t) => (
              <li key={t.name}>
                <span className="meter-label">
                  {t.name}
                  <strong>{pct(t.rate)}</strong>
                </span>
                <Meter value={t.rate} label={`${t.name} sell-through`} />
                <span className="muted small">
                  {num(t.sold)} of {num(t.total)} · {euro(t.revenueCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="chart-card" aria-labelledby="past-heading">
          <header className="chart-card-head">
            <div>
              <h3 id="past-heading">Recent events</h3>
              <p className="chart-sub">The last 8 in this period</p>
            </div>
          </header>
          <div className="table-scroll" role="region" aria-label="Recent events" tabIndex={0}>
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Sold</th>
                  <th scope="col">Attended</th>
                  <th scope="col">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {[...view.events]
                  .reverse()
                  .slice(0, 8)
                  .map((e) => (
                    <tr key={e.id}>
                      <th scope="row">
                        {e.title}
                        <small>{formatDay(e.startsAt)}</small>
                      </th>
                      <td>
                        {e.sold}/{e.capacity}
                        <Meter value={e.sold / e.capacity} label={`${e.title} sell-through`} />
                      </td>
                      <td>{pct(e.checkedIn / Math.max(1, e.sold))}</td>
                      <td>{euro(e.ticketRevenueCents)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function ForecastSection({
  forecasts,
  selected,
  onSelect,
}: {
  forecasts: Forecast[];
  selected?: Forecast;
  onSelect: (id: string) => void;
}) {
  const label: Record<Forecast["status"], string> = {
    below: "Tracking below similar events",
    "on-track": "On track",
    ahead: "Ahead of similar events",
    "no-history": "Not enough similar events to forecast",
    "too-early": "Too early to forecast",
  };
  return (
    <section className="forecast" aria-labelledby="forecast-heading">
      <header className="insights-head">
        <div>
          <p className="eyebrow">On sale now</p>
          <h2 id="forecast-heading">Ticket sales forecast</h2>
        </div>
      </header>
      <p className="insights-sub">
        Pace baseline (FR 70): how far similar past events had sold at the same number of days out. The range is the
        middle 80% of those events. Not affected by the period filter.
      </p>
      {forecasts.length === 0 ? (
        <p className="insight-empty">
          No events on sale. <Link to="/organiser/events">Publish an event</Link> to see a forecast.
        </p>
      ) : (
        <div className="forecast-grid">
          <fieldset className="forecast-list">
            <legend className="sr-only">Choose an event to see its sales pace</legend>
            {forecasts.map((f) => (
              <label key={f.event.id} className={`forecast-card status-${f.status}`} data-testid="forecast-card">
                <input
                  type="radio"
                  name="forecast"
                  checked={selected?.event.id === f.event.id}
                  onChange={() => onSelect(f.event.id)}
                />
                <span className="forecast-title">{f.event.title}</span>
                <span className="muted small">
                  {formatDay(f.event.startsAt)} · {f.event.daysOut} days to go
                </span>
                <span className="forecast-figures">
                  <strong>{f.event.sold}</strong> sold of {f.event.capacity}
                  {f.status === "below" || f.status === "on-track" || f.status === "ahead" ? (
                    f.low >= f.event.capacity ? (
                      <> · on course to sell out</>
                    ) : (
                      <>
                        {" "}
                        · projected <strong>{f.projected}</strong> (likely {f.low}–{f.high})
                      </>
                    )
                  ) : null}
                </span>
                <span className={`forecast-flag flag-${f.status}`}>
                  {f.status === "below" ? <Icon name="info" size={14} /> : null} {label[f.status]}
                </span>
              </label>
            ))}
          </fieldset>
          {selected && selected.band.length ? (
            <ChartCard
              title={`Sales pace: ${selected.event.title}`}
              subtitle={`Compared with ${selected.similar.length} ${selected.similarRule}`}
              table={{
                caption: `Sales pace for ${selected.event.title}`,
                columns: ["Days before event", "This event", "Similar (median)", "Middle 80%"],
                rows: [...selected.band]
                  .sort((a, b) => b.d - a.d)
                  .filter((p) => p.d % 7 === 0 || p.d === selected.event.daysOut)
                  .map((p) => [
                    p.d,
                    selected.event.cumulative[p.d] ?? "–",
                    Math.round(p.p50),
                    `${Math.round(p.p10)}–${Math.round(p.p90)}`,
                  ]),
              }}
            >
              <PaceChart
                ariaLabel={`Sales pace for ${selected.event.title}: ${selected.event.sold} sold with ${selected.event.daysOut} days to go; similar events had about ${Math.round(selected.expectedNow)} at this point.`}
                capacity={selected.event.capacity}
                daysOut={selected.event.daysOut}
                points={selected.band.map((p) => ({ ...p, actual: selected.event.cumulative[p.d] }))}
              />
            </ChartCard>
          ) : selected ? (
            <p className="insight-empty">
              <StatusPill status="Published" /> {selected.event.title}: {label[selected.status].toLowerCase()}.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Venue */

/** Venue operator analytics (FR 68, FR 69, FR 71). */
export function VenueAnalytics() {
  useDocumentTitle("Venue analytics");
  const { db, userId } = useStore();
  const myVenues = db.venues.filter((v) => v.memberIds.includes(userId));
  const [periodId, setPeriodId] = useState<PeriodId>("ytd");
  const [venueId, setVenueId] = useState("all");
  const history = getHistory();
  const period = getPeriod(periodId);
  const venueIds = venueId === "all" ? myVenues.map((v) => v.id) : [venueId];
  const venueKey = venueIds.join(",");

  const view = useMemo(() => {
    const scope = scopeHistory(history, { start: period.start, end: period.end, venueIds });
    const prev = period.previous ? scopeHistory(history, { ...period.previous, venueIds }) : undefined;
    const bar = barByInterval(scope.events);
    const peak = bar.reduce((m, b) => (b.value > m.value ? b : m), bar[0] ?? { interval: 0, value: 0, n: 0 });
    return {
      scope,
      kpis: venueKpis(scope.bookings, scope.events, scope.openDates, venueIds.length),
      prevKpis: prev ? venueKpis(prev.bookings, prev.events, prev.openDates, venueIds.length) : undefined,
      occupancy: monthlyOccupancy(scope.bookings, scope.openDates, venueIds.length, period.start, period.end),
      bar,
      peak,
      insights: venueInsights(scope.events, scope.bookings, scope.openDates, venueIds.length),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, period.start, period.end, venueKey]);

  const { kpis, prevKpis } = view;
  const vs = period.previous?.label;
  const venueName = (id: string) => db.venues.find((v) => v.id === id)?.name ?? id;
  const intervalLabel = (i: number) => `${i * 15}–${i * 15 + 15}`;

  return (
    <section className="page analytics-page">
      <p className="eyebrow">Venue operator</p>
      <h1 className="page-title">Venue analytics</h1>

      <div className="filter-row" role="group" aria-label="Filters for every figure on this page">
        <PeriodFilter value={periodId} onChange={setPeriodId} />
        <div className="field inline-field">
          <label htmlFor="va-venue">Venue</label>
          <select id="va-venue" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="all">All my venues ({myVenues.length})</option>
            {myVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stat-row">
        <StatTile hero label="Occupancy (booked evenings)" value={pct(kpis.occupancy)} delta={delta(kpis.occupancy, prevKpis?.occupancy, "points", vs)} />
        <StatTile label="Bookings" value={num(kpis.bookings)} delta={delta(kpis.bookings, prevKpis?.bookings, "relative", vs)} />
        <StatTile label="Booking revenue" value={euro(kpis.bookingRevenueCents)} delta={delta(kpis.bookingRevenueCents, prevKpis?.bookingRevenueCents, "relative", vs)} />
        <StatTile label="Bar revenue per attendee" value={formatMoney(Math.round(kpis.barPerAttendeeCents), { exact: true })} delta={delta(kpis.barPerAttendeeCents, prevKpis?.barPerAttendeeCents, "relative", vs)} />
      </div>

      <InsightsPanel insights={view.insights} scopeNote={`${period.label.toLowerCase()}, ${venueId === "all" ? "all your venues" : venueName(venueId)}`} />

      <div className="chart-grid">
        <ChartCard
          title="Occupancy by month"
          subtitle="Booked evenings ÷ open evenings (Tuesday to Sunday)"
          table={{
            caption: "Occupancy by month",
            columns: ["Month", "Occupancy", "Booked", "Open evenings"],
            rows: view.occupancy.map((m) => [monthLabel(m.month), pct(m.value), m.booked, m.open]),
          }}
        >
          <ColumnChart
            ariaLabel="Occupancy by month"
            yFormat={(v) => pct(v)}
            data={view.occupancy.map((m) => ({
              key: m.month,
              label: monthLabel(m.month),
              value: m.value,
              display: pct(m.value),
              detail: `${m.booked} of ${m.open} evenings`,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Bar sales by 15 minutes from doors"
          subtitle={
            view.peak.value ? (
              <>
                Average per event. Peak: <strong>{intervalLabel(view.peak.interval)} min</strong> after doors (FR 69)
              </>
            ) : (
              "Average per event (FR 69)"
            )
          }
          table={{
            caption: "Average bar takings per 15-minute interval from doors",
            columns: ["Minutes after doors", "Average takings", "Events"],
            rows: view.bar.map((b) => [intervalLabel(b.interval), formatMoney(Math.round(b.value)), b.n]),
          }}
        >
          <ColumnChart
            ariaLabel="Average bar takings per 15-minute interval from doors"
            yFormat={euroAxis}
            highlightKey={String(view.peak.interval)}
            data={view.bar.map((b) => ({
              key: String(b.interval),
              label: `${b.interval * 15}`,
              value: b.value,
              display: formatMoney(Math.round(b.value)),
              detail: `${intervalLabel(b.interval)} min after doors`,
            }))}
          />
          <p className="chart-hint">Minutes after doors along the bottom. The peak interval is highlighted.</p>
        </ChartCard>
      </div>

      <div className="chart-grid">
        <section className="chart-card" aria-labelledby="split-heading">
          <header className="chart-card-head">
            <div>
              <h3 id="split-heading">Revenue split</h3>
              <p className="chart-sub">Room hire vs bar takings, {period.label.toLowerCase()}</p>
            </div>
          </header>
          <SegmentBar
            ariaLabel={`Room hire ${euro(kpis.bookingRevenueCents)}, bar ${euro(kpis.barRevenueCents)}`}
            parts={[
              { label: "Room hire", value: kpis.bookingRevenueCents, display: euro(kpis.bookingRevenueCents) },
              { label: "Bar", value: kpis.barRevenueCents, display: euro(kpis.barRevenueCents) },
            ]}
          />
          <p className="muted small">
            {num(kpis.attendees)} attendees across {view.scope.events.length} ticketed events, plus{" "}
            {view.scope.bookings.filter((b) => b.kind === "private").length} private hires.
          </p>
        </section>
        <section className="chart-card" aria-labelledby="venue-events-heading">
          <header className="chart-card-head">
            <div>
              <h3 id="venue-events-heading">Recent events at your venues</h3>
              <p className="chart-sub">The last 8 in this period</p>
            </div>
          </header>
          <div className="table-scroll" role="region" aria-label="Recent events at your venues" tabIndex={0}>
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Attended</th>
                  <th scope="col">Sold</th>
                  <th scope="col">Bar per head</th>
                </tr>
              </thead>
              <tbody>
                {[...view.scope.events]
                  .reverse()
                  .slice(0, 8)
                  .map((e) => (
                    <tr key={e.id}>
                      <th scope="row">
                        {e.title}
                        <small>
                          {formatDay(e.startsAt)} · {venueName(e.venueId)} · {e.organiserName}
                        </small>
                      </th>
                      <td>{e.checkedIn}</td>
                      <td>{pct(e.sold / e.capacity)}</td>
                      <td>{formatMoney(Math.round(barPerAttendee(e)), { exact: true })}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
