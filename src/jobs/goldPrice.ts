export const GOLD_PRICE_TTL_MS = 15 * 60_000;
export const GOLD_PRICE_ERROR_TTL_MS = 60_000;
export const YAHOO_GOLD_SYMBOL = "GC=F";
export const DEFAULT_YAHOO_GOLD_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=10d";

export type OverviewGold = {
  source: "yahoo";
  symbol: typeof YAHOO_GOLD_SYMBOL;
  value: number;
  changePct: number | null;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewGold | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetGoldPriceCache(): void {
  cache = null;
}

function asOfFromUnix(seconds: unknown): string {
  const n = Number(seconds);
  if (Number.isFinite(n) && n > 0) {
    return new Date(n * 1000).toISOString();
  }
  return new Date(0).toISOString();
}

function changePct(value: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior <= 0) {
    return null;
  }
  return Number((((value - prior) / prior) * 100).toFixed(2));
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

export function parseYahooGold(raw: unknown): OverviewGold | null {
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
  const prior = Number(meta.chartPreviousClose);
  const points = closesFromChart(raw);
  const last = points.at(-1);
  const prevClose = points.at(-2);
  const value = Number.isFinite(live) && live > 0 ? live : last?.v;
  if (!value || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const baseline = Number.isFinite(prior) && prior > 0 ? prior : prevClose?.v;
  const asOfSeconds = meta.regularMarketTime ?? last?.t;
  return {
    source: "yahoo",
    symbol: YAHOO_GOLD_SYMBOL,
    value: Number(value.toFixed(2)),
    changePct: baseline ? changePct(value, baseline) : null,
    asOf: asOfFromUnix(asOfSeconds),
  };
}

export async function loadGoldPrice(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  url?: string;
}): Promise<OverviewGold | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(opts?.url ?? DEFAULT_YAHOO_GOLD_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; signal-desk/0.0.1)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: GOLD_PRICE_ERROR_TTL_MS };
      return null;
    }
    const value = parseYahooGold(await response.json());
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? GOLD_PRICE_TTL_MS : GOLD_PRICE_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: GOLD_PRICE_ERROR_TTL_MS };
    return null;
  }
}
