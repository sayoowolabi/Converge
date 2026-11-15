/**
 * Formatting helpers: money in euro, times in Europe/Dublin (NFR 32),
 * distances in metres/kilometres.
 */

const TZ = "Europe/Dublin";

/**
 * Fixed "today" for the demo, so date filters and sales windows behave the
 * same whenever the prototype is run (DECISIONS D-024). The ticket hold
 * countdown uses the real clock.
 */
export const DEMO_NOW = new Date("2026-11-18T10:00:00Z");

export function formatMoney(cents: number, opts: { exact?: boolean } = {}): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: opts.exact || !whole ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDay(iso: string): string {
  // e.g. "Sat 21 Nov"
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  // e.g. "Saturday 21 November 2026"
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  // e.g. "7:30 pm"
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function formatDayTime(iso: string): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/** YYYY-MM-DD of an instant in Europe/Dublin. */
export function dublinDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/**
 * Build a UTC ISO string from a Dublin wall-clock date and time.
 * Ireland is on GMT (UTC+0) from late October to late March, which covers
 * every date in the mock data; summer dates add one hour (IST, UTC+1).
 */
export function dublinToIso(date: string, time: string): string {
  const naive = new Date(`${date}T${time}:00Z`);
  const offsetH = isIrishSummerTime(naive) ? 1 : 0;
  return new Date(naive.getTime() - offsetH * 3600_000).toISOString();
}

function isIrishSummerTime(d: Date): boolean {
  const y = d.getUTCFullYear();
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(y, month + 1, 0));
    last.setUTCDate(last.getUTCDate() - last.getUTCDay());
    return last;
  };
  const start = lastSunday(2); // March
  const end = lastSunday(9); // October
  start.setUTCHours(1);
  end.setUTCHours(1);
  return d >= start && d < end;
}

/** Wall-clock HH:MM in Dublin for an ISO instant (for form inputs). */
export function dublinTimeKey(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
}

/** Walking minutes at roughly 80 m per minute. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.ceil(metres / 80));
}

/** Great-circle distance in metres. Stand-in for PostGIS ST_Distance on geography. */
export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newId(prefix: string): string {
  return `${prefix}-${randomToken(6)}`;
}
