import xlsx from "xlsx";

export const GPR_DAILY_TTL_MS = 12 * 60 * 60_000;
export const GPR_DAILY_ERROR_TTL_MS = 5 * 60_000;
export const DEFAULT_GPR_DAILY_URL =
  "https://www.matteoiacoviello.com/gpr_files/data_gpr_daily_recent.xls";
/** Daily GPR near 100 is the long-run average. 250 fills the stress bar. */
export const GPR_STRESS_CAP = 250;

export type OverviewGpr = {
  source: "iacoviello";
  value: number;
  classification: string;
  stress: number;
  calm: number;
  asOf: string;
};

type CacheEntry = {
  at: number;
  value: OverviewGpr | null;
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetGprDailyCache(): void {
  cache = null;
}

export function classifyGpr(value: number): string {
  if (value < 80) {
    return "Calm";
  }
  if (value < 120) {
    return "Normal";
  }
  if (value < 180) {
    return "Elevated";
  }
  return "High";
}

export function gprBar(value: number): { stress: number; calm: number } {
  const stress = Math.min(100, Math.max(0, (value / GPR_STRESS_CAP) * 100));
  return { stress, calm: 100 - stress };
}

function gprDay(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const day = String(Math.trunc(value));
    return /^\d{8}$/.test(day) ? day : null;
  }
  if (typeof value === "string") {
    const day = value.replace(/\D/g, "").slice(0, 8);
    return /^\d{8}$/.test(day) ? day : null;
  }
  return null;
}

function dayAsOf(day: string): string {
  return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T00:00:00.000Z`;
}

export function parseGprDailyRows(rows: unknown[]): OverviewGpr | null {
  const parsed: { day: string; value: number }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const item = row as { DAY?: unknown; GPRD?: unknown };
    const day = gprDay(item.DAY);
    const value = Number(item.GPRD);
    if (!day || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    parsed.push({ day, value });
  }
  parsed.sort((a, b) => a.day.localeCompare(b.day));
  const last = parsed.at(-1);
  if (!last) {
    return null;
  }
  const { stress, calm } = gprBar(last.value);
  return {
    source: "iacoviello",
    value: Number(last.value.toFixed(2)),
    classification: classifyGpr(last.value),
    stress,
    calm,
    asOf: dayAsOf(last.day),
  };
}

export function parseGprDailyWorkbook(input: Buffer): OverviewGpr | null {
  const workbook = xlsx.read(input, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return null;
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return null;
  }
  return parseGprDailyRows(xlsx.utils.sheet_to_json(sheet, { defval: null }));
}

export async function loadGprDaily(opts?: {
  fetchImpl?: typeof fetch;
  now?: Date;
  url?: string;
}): Promise<OverviewGpr | null> {
  const now = opts?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const fetchImpl = opts?.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(opts?.url ?? DEFAULT_GPR_DAILY_URL, {
      headers: {
        accept: "application/vnd.ms-excel,application/octet-stream,*/*",
        "user-agent": "signal-desk/0.0.1",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      cache = { at: now.getTime(), value: null, ttlMs: GPR_DAILY_ERROR_TTL_MS };
      return null;
    }
    const value = parseGprDailyWorkbook(Buffer.from(await response.arrayBuffer()));
    cache = {
      at: now.getTime(),
      value,
      ttlMs: value ? GPR_DAILY_TTL_MS : GPR_DAILY_ERROR_TTL_MS,
    };
    return value;
  } catch {
    cache = { at: now.getTime(), value: null, ttlMs: GPR_DAILY_ERROR_TTL_MS };
    return null;
  }
}
