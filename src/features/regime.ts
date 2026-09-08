import type { VolRegime } from "../domain/index.js";

export function volRegimeFromTerciles(series: number[]): VolRegime {
  const latest = series[series.length - 1];
  if (latest === undefined || series.length < 3) {
    return "mid";
  }
  const sorted = [...series].sort((a, b) => a - b);
  const p33 = percentile(sorted, 1 / 3);
  const p67 = percentile(sorted, 2 / 3);
  if (latest <= p33) {
    return "low";
  }
  if (latest >= p67) {
    return "high";
  }
  return "mid";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const left = sorted[lo] ?? 0;
  const right = sorted[hi] ?? left;
  if (lo === hi) {
    return left;
  }
  return left + (right - left) * (idx - lo);
}
