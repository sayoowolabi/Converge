/**
 * Hand-built SVG charts for the analytics dashboards (no chart library: the
 * prototype adds no dependency beyond the router). Follows the dataviz rules
 * (DECISIONS D-048): thin marks, 4px rounded data ends, one axis, hairline
 * grid, text in text colours, a tooltip on hover and keyboard focus, and a
 * table view for every chart (ChartCard).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { niceTicks } from "../../analytics/stats";
import { Icon } from "../Icon";

/** Width of a container in CSS pixels, so SVG text renders at its real size at any width. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/* ------------------------------------------------------------------ Card + table view */

export interface TableSpec {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}

export function ChartCard({
  title,
  subtitle,
  table,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: ReactNode;
  table: TableSpec;
  children: ReactNode;
  wide?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();
  return (
    <section className={`chart-card ${wide ? "wide" : ""}`} aria-labelledby={headingId}>
      <header className="chart-card-head">
        <div>
          <h3 id={headingId}>{title}</h3>
          {subtitle ? <p className="chart-sub">{subtitle}</p> : null}
        </div>
        <button type="button" className="text-button" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </header>
      {asTable ? (
        <div className="table-scroll" role="region" aria-label={`${title} table`} tabIndex={0}>
          <table className="data-table compact-table">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) =>
                    j === 0 ? (
                      <th key={j} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={j}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Column chart */

export interface ColumnDatum {
  key: string;
  label: string; // axis label
  value: number;
  display: string; // formatted value for tooltip / labels
  detail?: string; // extra tooltip line
}

/** Single-series column chart. `highlightKey` emphasises one column and greys the rest. */
export function ColumnChart({
  data,
  ariaLabel,
  yFormat,
  highlightKey,
  height = 220,
}: {
  data: ColumnDatum[];
  ariaLabel: string;
  yFormat: (v: number) => string;
  highlightKey?: string;
  height?: number;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const pad = { top: 22, right: 8, bottom: 26, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = niceTicks(max || 1, 4);
  const top = ticks[ticks.length - 1];
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, Math.max(4, band * 0.62));
  const every = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56))));
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const peakIndex = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="group" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h, barW / 2);
          const x = cx - barW / 2;
          const yTop = y(0) - h;
          const muted = highlightKey !== undefined && d.key !== highlightKey;
          // 4px rounded data end, square at the baseline.
          const path =
            h > 0
              ? `M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`
              : "";
          return (
            <g key={d.key}>
              {path ? <path d={path} className={muted ? "mark-muted" : "mark-1"} opacity={active !== null && active !== i ? 0.75 : 1} /> : null}
              <rect
                className="hit"
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={innerH}
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${d.display}${d.detail ? `, ${d.detail}` : ""}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
              {i % every === 0 ? (
                <text className="tick" x={cx} y={height - 8} textAnchor="middle">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <line className="axis" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
        {data.length && data[peakIndex].value > 0 && (highlightKey === undefined || highlightKey === data[peakIndex].key) ? (
          <text className="direct-label" x={pad.left + band * peakIndex + band / 2} y={y(data[peakIndex].value) - 6} textAnchor="middle">
            {data[peakIndex].display}
          </text>
        ) : null}
      </svg>
      {active !== null ? (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(width - 150, Math.max(0, pad.left + band * active + band / 2 - 70)),
            top: Math.max(0, y(data[active].value) - 58),
          }}
          aria-hidden="true"
        >
          <strong>{data[active].display}</strong>
          <span>{data[active].label}</span>
          {data[active].detail ? <span>{data[active].detail}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Sales pace chart */

export interface PacePoint {
  d: number; // days before the event
  p10: number;
  p50: number;
  p90: number;
  actual?: number;
}

/**
 * Cumulative sales of one event against the p10–p90 band and median of similar
 * past events (FR 70). One axis (tickets); x runs from the earliest day on sale to the event.
 */
export function PaceChart({
  points,
  capacity,
  daysOut,
  ariaLabel,
}: {
  points: PacePoint[];
  capacity: number;
  daysOut: number;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const height = 260;
  const pad = { top: 24, right: width < 480 ? 74 : 112, bottom: 30, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxD = Math.max(...points.map((p) => p.d));
  const ticks = niceTicks(capacity, 4);
  const top = Math.max(capacity, ticks[ticks.length - 1]);
  const x = (d: number) => pad.left + ((maxD - d) / Math.max(1, maxD)) * innerW;
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const sorted = [...points].sort((a, b) => b.d - a.d);
  const line = (key: "p50" | "actual") =>
    sorted
      .filter((p) => p[key] !== undefined)
      .map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p[key]!).toFixed(1)}`)
      .join(" ");
  const bandPath =
    sorted.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.p90).toFixed(1)}`).join(" ") +
    " " +
    [...sorted]
      .reverse()
      .map((p) => `L${x(p.d).toFixed(1)},${y(p.p10).toFixed(1)}`)
      .join(" ") +
    " Z";
  const actualPts = sorted.filter((p) => p.actual !== undefined);
  const last = actualPts[actualPts.length - 1];
  const endMedian = sorted[sorted.length - 1];
  const [cursor, setCursor] = useState<number | null>(null);
  const cur = cursor === null ? null : points.find((p) => p.d === cursor);
  const xTicks = [maxD, Math.round((maxD * 2) / 3), Math.round(maxD / 3), 0].filter((v, i, a) => a.indexOf(v) === i);

  const move = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    const d = Math.round(maxD - ((px - pad.left) / innerW) * maxD);
    setCursor(Math.max(0, Math.min(maxD, d)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const start = cursor ?? daysOut;
      setCursor(Math.max(0, Math.min(maxD, start + (e.key === "ArrowLeft" ? 1 : -1))));
    }
  };

  return (
    <div className="chart" ref={ref}>
      <ul className="legend" aria-label="Legend">
        <li>
          <span className="key-line s1" aria-hidden="true" /> This event
        </li>
        <li>
          <span className="key-line s2" aria-hidden="true" /> Similar past events (median)
        </li>
        <li>
          <span className="key-band" aria-hidden="true" /> Middle 80% of similar events
        </li>
      </ul>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setCursor(null)}
        onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setCursor(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} className="tick" x={x(d)} y={height - 10} textAnchor="middle">
            {d === 0 ? "Event" : `${d}d`}
          </text>
        ))}
        <line className="axis" x1={pad.left} x2={pad.left + innerW} y1={y(0)} y2={y(0)} />
        <line className="capacity" x1={pad.left} x2={pad.left + innerW} y1={y(capacity)} y2={y(capacity)} />
        <text className="tick" x={pad.left + 4} y={y(capacity) - 6}>
          Capacity {capacity}
        </text>
        <path d={bandPath} className="band-2" />
        <path d={line("p50")} className="line-2" />
        <text className="direct-label" x={x(0) + 6} y={y(endMedian.p50)} dy="0.32em">
          Similar: {Math.round(endMedian.p50)}
        </text>
        <line className="today" x1={x(daysOut)} x2={x(daysOut)} y1={pad.top} y2={y(0)} />
        <text className="tick" x={x(daysOut)} y={pad.top - 8} textAnchor="middle">
          Today
        </text>
        {actualPts.length > 1 ? <path d={line("actual")} className="line-1" /> : null}
        {last ? (
          <>
            <circle cx={x(last.d)} cy={y(last.actual!)} r={5} className="dot-1" />
            <text className="direct-label strong" x={x(last.d) + 9} y={y(last.actual!) - 9}>
              Sold: {last.actual}
            </text>
          </>
        ) : null}
        {cur ? <line className="crosshair" x1={x(cur.d)} x2={x(cur.d)} y1={pad.top} y2={y(0)} /> : null}
      </svg>
      {cur ? (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(width - 190, Math.max(0, x(cur.d) + 10)), top: pad.top }}
          aria-live="polite"
        >
          <span>{cur.d === 0 ? "Event day" : `${cur.d} days before`}</span>
          {cur.actual !== undefined ? (
            <span className="tt-row">
              <span className="key-line s1" aria-hidden="true" />
              <strong>{cur.actual}</strong> this event
            </span>
          ) : null}
          <span className="tt-row">
            <span className="key-line s2" aria-hidden="true" />
            <strong>{Math.round(cur.p50)}</strong> similar (median)
          </span>
          <span className="tt-row">
            <strong>
              {Math.round(cur.p10)}–{Math.round(cur.p90)}
            </strong>{" "}
            middle 80%
          </span>
        </div>
      ) : null}
      <p className="chart-hint">
        <Icon name="info" size={14} /> Hover, or focus the chart and use the arrow keys, to read values by day.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Figures */

export function StatTile({
  label,
  value,
  delta,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: { text: string; direction: "up" | "down" | "flat"; vs: string };
  hero?: boolean;
}) {
  return (
    <div className={`stat-tile ${hero ? "hero" : ""}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {delta ? (
        <p className="stat-delta">
          <span aria-hidden="true">{delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "–"}</span>{" "}
          {delta.text} <span className="muted">vs {delta.vs}</span>
        </p>
      ) : (
        <p className="stat-delta muted">No earlier period to compare</p>
      )}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="meter" role="img" aria-label={`${label}: ${pct}%`}>
      <span className="meter-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Thin segmented bar (part of a whole) with a legend carrying the numbers. */
export function SegmentBar({ parts, ariaLabel }: { parts: { label: string; value: number; display: string }[]; ariaLabel: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div className="segment-wrap">
      <div className="segment-bar" role="img" aria-label={ariaLabel}>
        {parts.map((p, i) => (
          <span key={p.label} className={`segment s${i + 1}`} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <span className={`key-rect s${i + 1}`} aria-hidden="true" /> {p.label}:{" "}
            <strong>{p.display}</strong> ({Math.round((p.value / total) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}
