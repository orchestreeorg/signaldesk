import type { TapeTick } from "../collectors/tape/types.js";
import type { Asset, FeatureSnapshot } from "../domain/index.js";
import { buildBars, logReturns, rollingStdevs } from "./bars.js";
import type { FlowAdapter } from "./flows.js";
import { nullFlowAdapter } from "./flows.js";
import { volRegimeFromTerciles } from "./regime.js";
import { FEATURE_WINDOW_MS, ROLLING_VOL_BARS, windowStartMs } from "./window.js";

function round(value: number | null): number | null {
  if (value === null) {
    return null;
  }
  return Number(value.toFixed(8));
}

function assetsIn(ticks: TapeTick[]): Asset[] {
  return [...new Set(ticks.map((tick) => tick.asset))].sort();
}

export function cvdOf(ticks: TapeTick[], asset: Asset, fromMs: number): number | null {
  let sum = 0;
  let seen = false;
  for (const tick of ticks) {
    if (tick.asset !== asset || tick.ts.getTime() < fromMs || tick.cvdDelta === null) {
      continue;
    }
    sum += tick.cvdDelta;
    seen = true;
  }
  return seen ? sum : null;
}

export function lastFunding(ticks: TapeTick[], asset: Asset, fromMs: number): number | null {
  let funding: number | null = null;
  let latest = -1;
  for (const tick of ticks) {
    if (tick.asset !== asset || tick.kind !== "mark" || tick.funding === null) {
      continue;
    }
    const time = tick.ts.getTime();
    if (time < fromMs) {
      continue;
    }
    if (time >= latest) {
      latest = time;
      funding = tick.funding;
    }
  }
  return funding;
}

export function oiChangePct(ticks: TapeTick[], asset: Asset, fromMs: number): number | null {
  const series = ticks
    .filter((tick) => tick.asset === asset && tick.kind === "oi" && tick.openInterest !== null && tick.ts.getTime() >= fromMs)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const first = series[0]?.openInterest;
  const last = series[series.length - 1]?.openInterest;
  if (first == null || last == null || first === 0 || series.length < 2) {
    return null;
  }
  return ((last - first) / first) * 100;
}

export async function buildFeatureSnapshots(
  ticks: TapeTick[],
  now: Date,
  flows: FlowAdapter = nullFlowAdapter,
): Promise<FeatureSnapshot[]> {
  if (ticks.length === 0) {
    return [];
  }
  const earliest = Math.min(...ticks.map((tick) => tick.ts.getTime()));
  const fromMs = windowStartMs(now, earliest);
  const snapshots: FeatureSnapshot[] = [];

  for (const asset of assetsIn(ticks)) {
    const bars = buildBars(ticks, asset, fromMs, now.getTime());
    const returns = logReturns(bars);
    const vols = rollingStdevs(returns, ROLLING_VOL_BARS);
    snapshots.push({
      ts: now,
      asset,
      exchangeNetflowZ: await flows.exchangeNetflowZ(asset, now),
      stablecoinDeltaZ: await flows.stablecoinDeltaZ(asset, now),
      funding: round(lastFunding(ticks, asset, fromMs)),
      oiChangePct: round(oiChangePct(ticks, asset, fromMs)),
      cvd: round(cvdOf(ticks, asset, fromMs)),
      volRegime: volRegimeFromTerciles(vols),
    });
  }
  return snapshots;
}

export { FEATURE_WINDOW_MS };
