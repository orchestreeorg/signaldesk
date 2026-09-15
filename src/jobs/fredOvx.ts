import type { MacroObservationInput } from "./macroObservations.js";

export const FRED_OVX_TTL_MS = 15 * 60_000;
export const FRED_OVX_ERROR_TTL_MS = 60_000;
export const YAHOO_OVX_SYMBOL = "^OVX";
export const DEFAULT_YAHOO_OVX_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EOVX?interval=1d&range=1mo";
/** OVX at this level fills the stress bar. Typical spikes sit 50–80. */
export const OVX_STRESS_CAP = 80;

export type OverviewOvx = {
  source: "yahoo";
  symbol: typeof YAHOO_OVX_SYMBOL;
  value: number;
  classification: string;
  stress: number;
  calm: number;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewOvx | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;
let observations: MacroObservationInput[] = [];

export function resetFredOvxCache(): void {
  cache = null;
  observations = [];
}

export function classifyOvx(value: number): string {
  if (value < 25) {
    return "Calm";
  }
  if (value < 40) {
    return "Normal";
  }
  if (value < 55) {
    return "Elevated";
  }
  return "High";
}

export function ovxBar(value: number): { stress: number; calm: number } {
  const stress = Math.min(100, Math.max(0, (value / OVX_STRESS_CAP) * 100));
  return { stress, calm: 100 - stress };
}

function asOfFromUnix(seconds: unknown): string {
  const n = Number(seconds);
  if (Number.isFinite(n) && n > 0) {
    return new Date(n * 1000).toISOString();
  }
  return new Date(0).toISOString();
}

function closesFromChart(raw: unknown): { t: number; v: number }[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const result = (raw as { chart?: { result?: unknown } }).chart?.result;
  const row = Array.isArray(result) ? result[0] : null;
  if (!row || typeof row !== "object") {
    return [];
  }
  const item = row as {
    timestamp?: unknown;
    indicators?: { quote?: Array<{ close?: unknown }> };
  };
  const stamps = Array.isArray(item.timestamp) ? item.timestamp : [];
  const closes = item.indicators?.quote?.[0]?.close;
  const values = Array.isArray(closes) ? closes : [];
  const points: { t: number; v: number }[] = [];
  for (let i = 0; i < Math.min(stamps.length, values.length); i += 1) {
    const t = Number(stamps[i]);
    const v = Number(values[i]);
    if (Number.isFinite(t) && Number.isFinite(v) && v > 0) {
      points.push({ t, v });
    }
  }
  return points;
}

export function parseYahooOvxObservations(raw: unknown): MacroObservationInput[] {
  return closesFromChart(raw).map((point) => {
    const { stress, calm } = ovxBar(point.v);
    return {
      source: "ovx",
      asOf: asOfFromUnix(point.t),
      value: Number(point.v.toFixed(2)),
      aux: { symbol: YAHOO_OVX_SYMBOL, classification: classifyOvx(point.v), stress, calm },
    };
  });
}

export function getFredOvxObservations(): MacroObservationInput[] {
  return observations;
}

export function parseYahooOvx(raw: unknown): OverviewOvx | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const result = (raw as { chart?: { result?: unknown } }).chart?.result;
  const row = Array.isArray(result) ? result[0] : null;
  if (!row || typeof row !== "object") {
    return null;
  }
  const meta = (row as { meta?: Record<string, unknown> }).meta ?? {};
  const live = Number(meta.regularMarketPrice);
  const points = closesFromChart(raw);
  const last = points.at(-1);
  const value = Number.isFinite(live) && live > 0 ? live : last?.v;
  if (!value || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const asOfSeconds = meta.regularMarketTime ?? last?.t;
  const { stress, calm } = ovxBar(value);
  return {
    source: "yahoo",
    symbol: YAHOO_OVX_SYMBOL,
    value: Number(value.toFixed(2)),
    classification: classifyOvx(value),
    stress,
    calm,
    asOf: asOfFromUnix(asOfSeconds),
  };
}

export async function loadFredOvx(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  url?: string;
}): Promise<OverviewOvx | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(opts?.url ?? DEFAULT_YAHOO_OVX_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; signal-desk/0.0.1)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      observations = [];
      cache = { at: now.getTime(), value: null, ttlMs: FRED_OVX_ERROR_TTL_MS };
      return null;
    }
    const raw = await response.json();
    observations = parseYahooOvxObservations(raw);
    const value = parseYahooOvx(raw);
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? FRED_OVX_TTL_MS : FRED_OVX_ERROR_TTL_MS,
    };
    return value;
  } catch {
    observations = [];
    cache = { at: now.getTime(), value: null, ttlMs: FRED_OVX_ERROR_TTL_MS };
    return null;
  }
}
