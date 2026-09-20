export const NEAR_PRICE_TTL_MS = 60_000;
export const NEAR_PRICE_ERROR_TTL_MS = 20_000;
export const COINGECKO_NEAR_ID = "near";
export const DEFAULT_COINGECKO_NEAR_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd&include_24hr_change=true";
export const YAHOO_NEAR_SYMBOL = "NEAR-USD";
export const DEFAULT_YAHOO_NEAR_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/NEAR-USD?interval=1m&range=1d";

export type NearQuote = {
  source: "coingecko" | "yahoo";
  symbol: "NEAR";
  value: number;
  changePct: number | null;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: NearQuote | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetNearPriceCache(): void {
  cache = null;
}

export function lotValueFromQuote(tokens: number, quote: NearQuote | null): number | null {
  if (!quote || !Number.isFinite(tokens) || tokens <= 0) {
    return null;
  }
  return Number((tokens * quote.value).toFixed(2));
}

export function parseCoingeckoNearPrice(raw: unknown, asOf = new Date()): NearQuote | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = (raw as { near?: { usd?: unknown; usd_24h_change?: unknown } }).near;
  const value = Number(row?.usd);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const change = Number(row?.usd_24h_change);
  return {
    source: "coingecko",
    symbol: "NEAR",
    value: Number(value.toFixed(6)),
    changePct: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
    asOf: asOf.toISOString(),
  };
}

export function parseYahooNearPrice(raw: unknown): NearQuote | null {
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
  if (!Number.isFinite(live) || live <= 0) {
    return null;
  }
  const asOfSeconds = Number(meta.regularMarketTime);
  return {
    source: "yahoo",
    symbol: "NEAR",
    value: Number(live.toFixed(6)),
    changePct: Number.isFinite(prior) && prior > 0 ? Number((((live - prior) / prior) * 100).toFixed(2)) : null,
    asOf: Number.isFinite(asOfSeconds) && asOfSeconds > 0 ? new Date(asOfSeconds * 1000).toISOString() : new Date().toISOString(),
  };
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
): Promise<unknown | null> {
  try {
    const response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

export async function loadNearPrice(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  coingeckoUrl?: string;
  yahooUrl?: string;
}): Promise<NearQuote | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const apiKey = opts?.apiKey ?? process.env.COINGECKO_API_KEY ?? "";
  const geckoHeaders: Record<string, string> = {
    accept: "application/json",
    "user-agent": "signal-desk/0.0.1",
  };
  if (apiKey) {
    geckoHeaders["x-cg-demo-api-key"] = apiKey;
  }
  const geckoRaw = await fetchJson(fetchImpl, opts?.coingeckoUrl ?? DEFAULT_COINGECKO_NEAR_URL, geckoHeaders);
  const gecko = parseCoingeckoNearPrice(geckoRaw, now);
  if (gecko) {
    cache = { at: now.getTime(), value: gecko, ttlMs: NEAR_PRICE_TTL_MS };
    return gecko;
  }
  const yahooRaw = await fetchJson(fetchImpl, opts?.yahooUrl ?? DEFAULT_YAHOO_NEAR_URL, {
    accept: "application/json",
    "user-agent": "Mozilla/5.0 (compatible; signal-desk/0.0.1)",
  });
  const yahoo = parseYahooNearPrice(yahooRaw);
  cache = {
    at: now.getTime(),
    value: yahoo,
    ttlMs: yahoo ? NEAR_PRICE_TTL_MS : NEAR_PRICE_ERROR_TTL_MS,
  };
  return yahoo;
}
