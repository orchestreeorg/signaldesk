import type { Asset } from "../domain/index.js";
import type { TapeTick } from "../collectors/tape/types.js";
import { BAR_MS, barStartMs } from "./window.js";

export type PriceBar = {
  startMs: number;
  close: number;
};

export function priceOf(tick: TapeTick): number | null {
  return tick.price;
}

export function buildBars(ticks: TapeTick[], asset: Asset, fromMs: number, toMs: number): PriceBar[] {
  const byStart = new Map<number, number>();
  for (const tick of ticks) {
    if (tick.asset !== asset) {
      continue;
    }
    const price = priceOf(tick);
    if (price === null) {
      continue;
    }
    const start = barStartMs(tick.ts);
    if (start < fromMs || start > toMs) {
      continue;
    }
    byStart.set(start, price);
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startMs, close]) => ({ startMs, close }));
}

export function logReturns(bars: PriceBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1]?.close;
    const next = bars[i]?.close;
    if (prev === undefined || next === undefined || prev <= 0 || next <= 0) {
      continue;
    }
    returns.push(Math.log(next / prev));
  }
  return returns;
}

export function sampleStdev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function rollingStdevs(returns: number[], window: number): number[] {
  if (returns.length < 2) {
    return [];
  }
  const width = Math.min(window, returns.length);
  const out: number[] = [];
  for (let end = width; end <= returns.length; end += 1) {
    const slice = returns.slice(end - width, end);
    const stdev = sampleStdev(slice);
    if (stdev !== null) {
      out.push(stdev);
    }
  }
  return out;
}

export { BAR_MS };
