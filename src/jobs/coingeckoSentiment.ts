import { formatMixScore } from "./digest.js";

export const COINGECKO_SENTIMENT_TTL_MS = 15 * 60_000;
export const COINGECKO_SENTIMENT_ERROR_TTL_MS = 60_000;
export const DEFAULT_COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
export const COINGECKO_BTC_ID = "bitcoin";

export type OverviewSentiment = {
  source: "coingecko";
  asset: "BTC";
  up: number;
  down: number;
  score: number;
  label: string;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewSentiment | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetCoingeckoSentimentCache(): void {
  cache = null;
}

export function parseCoingeckoSentiment(raw: unknown, asOf = new Date()): OverviewSentiment | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const row = raw as {
    sentiment_votes_up_percentage?: unknown;
    sentiment_votes_down_percentage?: unknown;
  };
  const up = Number(row.sentiment_votes_up_percentage);
  const down = Number(row.sentiment_votes_down_percentage);
  if (!Number.isFinite(up) || !Number.isFinite(down) || up < 0 || down < 0) {
    return null;
  }
  const total = up + down;
  if (total <= 0) {
    return null;
  }
  const upPct = (up / total) * 100;
  const downPct = (down / total) * 100;
  const score = (upPct - downPct) / 100;
  return {
    source: "coingecko",
    asset: "BTC",
    up: upPct,
    down: downPct,
    score,
    label: formatMixScore(score),
    asOf: asOf.toISOString(),
  };
}

export function coingeckoBitcoinUrl(baseUrl = DEFAULT_COINGECKO_API_BASE): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/coins/${COINGECKO_BTC_ID}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`;
}

export async function loadCoingeckoSentiment(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  baseUrl?: string;
}): Promise<OverviewSentiment | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const apiKey = opts?.apiKey ?? process.env.COINGECKO_API_KEY ?? "";
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "signal-desk/0.0.1",
  };
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }
  try {
    const response = await fetchImpl(coingeckoBitcoinUrl(opts?.baseUrl), {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: COINGECKO_SENTIMENT_ERROR_TTL_MS };
      return null;
    }
    const value = parseCoingeckoSentiment(await response.json(), now);
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? COINGECKO_SENTIMENT_TTL_MS : COINGECKO_SENTIMENT_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: COINGECKO_SENTIMENT_ERROR_TTL_MS };
    return null;
  }
}
