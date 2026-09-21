import type { NearLot, NearLotSide } from "./nearLots.js";

export const NEAR_CHART_LIMIT = 40;
export const NEAR_HOLDINGS_GOAL_USD = 300_000;

export type HoldingsCandle = {
  id: string;
  side: NearLotSide;
  at: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tokens: number;
  lotValue: number;
};

export type ChartLot = Pick<NearLot, "id" | "side" | "tokens" | "value"> & { at: Date | string };

function lotTime(lot: ChartLot): number {
  const ts = lot.at instanceof Date ? lot.at.getTime() : Date.parse(String(lot.at));
  return Number.isFinite(ts) ? ts : 0;
}

function lotIso(lot: ChartLot): string {
  if (lot.at instanceof Date) {
    return lot.at.toISOString();
  }
  const parsed = new Date(lot.at);
  return Number.isNaN(parsed.getTime()) ? String(lot.at) : parsed.toISOString();
}

/** Oldest → newest running USD held. Each lot is one candle: open = held before, close = held after. */
export function holdingsCandles(lots: ChartLot[], limit = NEAR_CHART_LIMIT): HoldingsCandle[] {
  const chronological = [...lots].sort((a, b) => {
    const delta = lotTime(a) - lotTime(b);
    if (delta !== 0) {
      return delta;
    }
    return a.id.localeCompare(b.id);
  });
  let held = 0;
  const candles: HoldingsCandle[] = [];
  for (const lot of chronological) {
    const open = held;
    held = lot.side === "entry" ? held + lot.value : held - lot.value;
    const close = held;
    candles.push({
      id: lot.id,
      side: lot.side,
      at: lotIso(lot),
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      tokens: lot.tokens,
      lotValue: lot.value,
    });
  }
  return candles.slice(-Math.max(1, limit));
}

/** Y-axis: floor at 0 (or the lowest wick), roof at the 300k USD goal. */
export function holdingsScale(candles: Array<Pick<HoldingsCandle, "low" | "high">>): { min: number; max: number } {
  const lows = candles.map((row) => row.low);
  const min = candles.length === 0 ? 0 : Math.min(0, ...lows);
  return { min, max: NEAR_HOLDINGS_GOAL_USD };
}
