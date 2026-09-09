export const FRED_SP500_TTL_MS = 15 * 60_000;
export const FRED_SP500_ERROR_TTL_MS = 60_000;
export const FRED_SP500_SERIES_ID = "SP500";
export const DEFAULT_FRED_OBSERVATIONS_URL = "https://api.stlouisfed.org/fred/series/observations";

export type OverviewSp500 = {
  source: "fred";
  seriesId: typeof FRED_SP500_SERIES_ID;
  value: number;
  changePct: number | null;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewSp500 | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetFredSp500Cache(): void {
  cache = null;
}

function observationAsOf(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return `${date}T00:00:00.000Z`;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}

function numericObservations(raw: unknown): { date: string; value: number }[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const observations = (raw as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return [];
  }
  const rows: { date: string; value: number }[] = [];
  for (const row of observations) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const item = row as { date?: unknown; value?: unknown };
    const date = typeof item.date === "string" ? item.date : "";
    const value = Number(item.value);
    if (!date || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    rows.push({ date, value });
  }
  return rows;
}

export function parseFredSp500(raw: unknown): OverviewSp500 | null {
  const rows = numericObservations(raw);
  const latest = rows[0];
  if (!latest) {
    return null;
  }
  const prior = rows[1]?.value;
  const changePct =
    prior && prior > 0 ? Number((((latest.value - prior) / prior) * 100).toFixed(2)) : null;
  return {
    source: "fred",
    seriesId: FRED_SP500_SERIES_ID,
    value: Number(latest.value.toFixed(2)),
    changePct,
    asOf: observationAsOf(latest.date),
  };
}

export function fredSp500Url(apiKey: string, seriesId = FRED_SP500_SERIES_ID): string {
  const url = new URL(DEFAULT_FRED_OBSERVATIONS_URL);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "8");
  return url.toString();
}

export async function loadFredSp500(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  apiKey?: string;
  url?: string;
}): Promise<OverviewSp500 | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const apiKey = opts?.apiKey ?? process.env["FRED_API_KEY"] ?? "";
  if (!apiKey) {
    cache = { at: now.getTime(), value: null, ttlMs: FRED_SP500_ERROR_TTL_MS };
    return null;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(opts?.url ?? fredSp500Url(apiKey), {
      headers: {
        accept: "application/json",
        "user-agent": "signal-desk/0.0.1",
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: FRED_SP500_ERROR_TTL_MS };
      return null;
    }
    const value = parseFredSp500(await response.json());
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? FRED_SP500_TTL_MS : FRED_SP500_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: FRED_SP500_ERROR_TTL_MS };
    return null;
  }
}
