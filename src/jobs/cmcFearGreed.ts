export const CMC_FEAR_GREED_TTL_MS = 15 * 60_000;
export const CMC_FEAR_GREED_ERROR_TTL_MS = 60_000;
export const DEFAULT_CMC_FEAR_GREED_URL =
  "https://pro-api.coinmarketcap.com/public-api/v3/fear-and-greed/latest";

export type OverviewFearGreed = {
  source: "coinmarketcap";
  value: number;
  classification: string;
  greed: number;
  fear: number;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewFearGreed | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetCmcFearGreedCache(): void {
  cache = null;
}

export function parseCmcFearGreed(raw: unknown, asOf = new Date()): OverviewFearGreed | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const envelope = raw as { data?: unknown };
  const inner = envelope.data && typeof envelope.data === "object" ? envelope.data : raw;
  const row = inner as { value?: unknown; value_classification?: unknown; update_time?: unknown };
  const value = Number(row.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }
  const classification = typeof row.value_classification === "string" ? row.value_classification.trim() : "";
  if (!classification) {
    return null;
  }
  const asOfRaw = typeof row.update_time === "string" ? row.update_time : asOf.toISOString();
  return {
    source: "coinmarketcap",
    value,
    classification,
    greed: value,
    fear: 100 - value,
    asOf: asOfRaw,
  };
}

export async function loadCmcFearGreed(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  url?: string;
}): Promise<OverviewFearGreed | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const apiKey = opts?.apiKey ?? process.env.CMC_API_KEY ?? "";
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "signal-desk/0.0.1",
  };
  if (apiKey) {
    headers["x-cmc_pro_api_key"] = apiKey;
  }
  try {
    const response = await fetchImpl(opts?.url ?? DEFAULT_CMC_FEAR_GREED_URL, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: CMC_FEAR_GREED_ERROR_TTL_MS };
      return null;
    }
    const value = parseCmcFearGreed(await response.json(), now);
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? CMC_FEAR_GREED_TTL_MS : CMC_FEAR_GREED_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: CMC_FEAR_GREED_ERROR_TTL_MS };
    return null;
  }
}
