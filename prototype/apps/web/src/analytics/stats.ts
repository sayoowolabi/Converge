/**
 * Small, dependency-free statistics helpers for the analytics prototype.
 * Everything that uses randomness is seeded, so results are reproducible
 * between runs (ml-design.md "Reproducibility", NFR 30).
 */

/** Mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, used to derive per-comparison seeds. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Standard normal via Box–Muller. */
export function normal(rand: () => number, mean = 0, sd = 1): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function pick<T>(rand: () => number, weighted: [T, number][]): T {
  const total = weighted.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [item, w] of weighted) {
    r -= w;
    if (r <= 0) return item;
  }
  return weighted[weighted.length - 1][0];
}

export const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Linear-interpolated quantile of an unsorted array (q in [0, 1]). */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface Comparison {
  /** Relative effect (ratio − 1) for "ratio", or difference in percentage points for "points". */
  effect: number;
  /** 95% bootstrap percentile interval. */
  lo: number;
  hi: number;
  /** Interval at the Bonferroni-adjusted level 1 − 0.05 / comparisons. */
  loAdj: number;
  hiAdj: number;
  meanA: number;
  meanB: number;
  nA: number;
  nB: number;
}

/**
 * Bootstrap comparison of two groups' means. "ratio" compares mean(a)/mean(b) − 1
 * (e.g. bar spend per head); "points" compares mean(a) − mean(b) for rates in 0–1,
 * returned in percentage points.
 */
export function compareMeans(
  a: number[],
  b: number[],
  kind: "ratio" | "points",
  seed: number,
  comparisons: number,
  resamples = 2000,
): Comparison {
  const rand = mulberry32(seed);
  const stat = (ma: number, mb: number) => (kind === "ratio" ? ma / mb - 1 : (ma - mb) * 100);
  const draws: number[] = [];
  for (let i = 0; i < resamples; i++) {
    let sa = 0;
    let sb = 0;
    for (let j = 0; j < a.length; j++) sa += a[Math.floor(rand() * a.length)];
    for (let j = 0; j < b.length; j++) sb += b[Math.floor(rand() * b.length)];
    draws.push(stat(sa / a.length, sb / b.length));
  }
  const alphaAdj = 0.05 / Math.max(1, comparisons);
  return {
    effect: stat(mean(a), mean(b)),
    lo: quantile(draws, 0.025),
    hi: quantile(draws, 0.975),
    loAdj: quantile(draws, alphaAdj / 2),
    hiAdj: quantile(draws, 1 - alphaAdj / 2),
    meanA: mean(a),
    meanB: mean(b),
    nA: a.length,
    nB: b.length,
  };
}

/** "Nice" axis ticks from 0 to at least max, about `count` steps. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
