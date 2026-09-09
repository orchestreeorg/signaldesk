export const FRED_OVX_TTL_MS = 15 * 60_000;
export const FRED_OVX_ERROR_TTL_MS = 60_000;
export const FRED_OVX_SERIES_ID = "OVXCLS";
export const DEFAULT_FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";
/** OVX at this level fills the stress bar. Typical spikes sit 50–80. */
export const OVX_STRESS_CAP = 80;

export type OverviewOvx = {
  source: "fred";
  seriesId: typeof FRED_OVX_SERIES_ID;
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

export function resetFredOvxCache(): void {
  cache = null;
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

function observationAsOf(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00:00.000Z`;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}

export function parseFredOvx(raw: unknown): OverviewOvx | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const observations = (raw as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return null;
  }
  for (const row of observations) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const item = row as { date?: unknown; value?: unknown };
    const date = typeof item.date === "string" ? item.date : "";
    const n = Number(item.value);
    if (!date || !Number.isFinite(n) || n <= 0) {
      continue;
    }
    const { stress, calm } = ovxBar(n);
    return {
      source: "fred",
      seriesId: FRED_OVX_SERIES_ID,
      value: Number(n.toFixed(2)),
      classification: classifyOvx(n),
      stress,
      calm,
      asOf: observationAsOf(date),
    };
  }
  return null;
}

export function fredOvxUrl(apiKey: string, seriesId = FRED_OVX_SERIES_ID): string {
  const url = new URL(DEFAULT_FRED_OBSERVATIONS_URL);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "8");
  return url.toString();
}

export async function loadFredOvx(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  url?: string;
}): Promise<OverviewOvx | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const apiKey = opts?.apiKey ?? process.env["FRED_API_KEY"] ?? "";
  if (!apiKey) {
    cache = { at: now.getTime(), value: null, ttlMs: FRED_OVX_ERROR_TTL_MS };
    return null;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(opts?.url ?? fredOvxUrl(apiKey), {
      headers: {
        accept: "application/json",
        "user-agent": "signal-desk/0.0.1",
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: FRED_OVX_ERROR_TTL_MS };
      return null;
    }
    const value = parseFredOvx(await response.json());
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? FRED_OVX_TTL_MS : FRED_OVX_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: FRED_OVX_ERROR_TTL_MS };
    return null;
  }
}
