import type pg from "pg";
import { ensureRawItemTable } from "../collectors/news/store.js";
import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import type { DeskSettings } from "../desk/types.js";
import type { AlertKind, Asset, FeatureSnapshot, Horizon } from "../domain/index.js";
import { headlineTone } from "../telegram/tone.js";

export const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DigestAlertRow = {
  id: string;
  kind: AlertKind;
  asset: Asset;
  why: string[];
  at: Date;
  realized24h: number | null;
  realized4h: number | null;
};

export type DigestItemRow = {
  title: string;
  publishedAt: Date;
};

export type DigestCallCounts = {
  FLASH: number;
  FADE: number;
  CONFIRM: number;
  INVALIDATE: number;
};

export type DigestLastCall = {
  kind: "FLASH" | "FADE";
  asset: Asset;
  why: string;
  realized: number | null;
  realizedLabel: "open" | "n/a";
  horizon: Horizon | null;
};

export type DigestMix = {
  bull: number;
  bear: number;
  neutral: number;
  score: number | null;
};

export type DigestReport = {
  now: Date;
  calls: DigestCallCounts;
  lastCall: DigestLastCall | null;
  mix: DigestMix;
  tape: string | null;
};

const CALL_KINDS = ["FLASH", "FADE", "CONFIRM", "INVALIDATE"] as const;
const LAST_KINDS = new Set(["FLASH", "FADE"]);

export function digestWindowStart(now: Date): Date {
  return new Date(now.getTime() - DIGEST_WINDOW_MS);
}

export function scoreNewsMix(
  items: DigestItemRow[],
  settings: DeskSettings = DEFAULT_DESK_SETTINGS,
): DigestMix {
  let bull = 0;
  let bear = 0;
  let neutral = 0;
  for (const item of items) {
    const tone = headlineTone(item.title, settings);
    if (tone === "BULLISH") {
      bull += 1;
    } else if (tone === "BEARISH") {
      bear += 1;
    } else {
      neutral += 1;
    }
  }
  const directional = bull + bear;
  return {
    bull,
    bear,
    neutral,
    score: directional === 0 ? null : (bull - bear) / directional,
  };
}

export function countCalls(alerts: DigestAlertRow[]): DigestCallCounts {
  const calls: DigestCallCounts = { FLASH: 0, FADE: 0, CONFIRM: 0, INVALIDATE: 0 };
  for (const alert of alerts) {
    if ((CALL_KINDS as readonly string[]).includes(alert.kind)) {
      calls[alert.kind as keyof DigestCallCounts] += 1;
    }
  }
  return calls;
}

export function pickLastCall(alerts: DigestAlertRow[]): DigestLastCall | null {
  const candidates = alerts
    .filter((alert) => LAST_KINDS.has(alert.kind))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const last = candidates[0];
  if (!last) {
    return null;
  }
  const realized = last.realized24h ?? last.realized4h;
  const horizon: Horizon | null = last.realized24h !== null ? "24h" : last.realized4h !== null ? "4h" : null;
  return {
    kind: last.kind as "FLASH" | "FADE",
    asset: last.asset,
    why: last.why[0] ?? "n/a",
    realized,
    realizedLabel: realized === null ? "open" : "n/a",
    horizon,
  };
}

export function tapeLine(snapshot?: FeatureSnapshot | null): string | null {
  if (!snapshot || (snapshot.cvd === null && snapshot.funding === null)) {
    return null;
  }
  const parts: string[] = [];
  if (snapshot.cvd !== null) {
    parts.push(snapshot.cvd >= 0 ? "CVD bid" : "CVD offer");
  }
  if (snapshot.funding !== null) {
    const sign = snapshot.funding >= 0 ? "+" : "";
    parts.push(`funding ${sign}${snapshot.funding.toFixed(4)}`);
  }
  parts.push(`vol ${snapshot.volRegime}`);
  return parts.join(" · ");
}

export function buildDigestReport(input: {
  now: Date;
  alerts: DigestAlertRow[];
  items: DigestItemRow[];
  settings?: DeskSettings;
  snapshot?: FeatureSnapshot | null;
}): DigestReport {
  return {
    now: input.now,
    calls: countCalls(input.alerts),
    lastCall: pickLastCall(input.alerts),
    mix: scoreNewsMix(input.items, input.settings ?? DEFAULT_DESK_SETTINGS),
    tape: tapeLine(input.snapshot),
  };
}

export function formatMixScore(score: number | null): string {
  if (score === null) {
    return "n/a";
  }
  const abs = Math.abs(score).toFixed(2);
  if (score > 0) {
    return `+${abs}`;
  }
  if (score < 0) {
    return `-${abs}`;
  }
  return abs;
}

export function formatRealized(value: number): string {
  const pct = value * 100;
  const abs = Math.abs(pct).toFixed(1);
  return pct >= 0 ? `+${abs}%` : `-${abs}%`;
}

async function loadDigestAlerts(pool: pg.Pool, from: Date): Promise<DigestAlertRow[]> {
  try {
    const result = await pool.query<{
      id: string;
      kind: string;
      asset: string;
      why: string[];
      at: Date;
      realized_24h: number | null;
      realized_4h: number | null;
    }>(
      `SELECT a.id, a.kind, a.asset, a.why, COALESCE(a.sent_at, a.created_at) AS at,
              MAX(CASE WHEN o.horizon = '24h' THEN o.realized_return END) AS realized_24h,
              MAX(CASE WHEN o.horizon = '4h' THEN o.realized_return END) AS realized_4h
         FROM alerts a
         LEFT JOIN outcomes o ON o.alert_id = a.id
        WHERE COALESCE(a.sent_at, a.created_at) >= $1
          AND a.kind IN ('FLASH', 'FADE', 'CONFIRM', 'INVALIDATE')
        GROUP BY a.id, a.kind, a.asset, a.why, COALESCE(a.sent_at, a.created_at)
        ORDER BY at DESC`,
      [from],
    );
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind as AlertKind,
      asset: row.asset as Asset,
      why: row.why ?? [],
      at: row.at,
      realized24h: row.realized_24h,
      realized4h: row.realized_4h,
    }));
  } catch {
    return [];
  }
}

async function loadDigestItems(pool: pg.Pool, from: Date): Promise<DigestItemRow[]> {
  await ensureRawItemTable(pool);
  const result = await pool.query<{ title: string; published_at: Date }>(
    `SELECT title, published_at FROM raw_items WHERE published_at >= $1 ORDER BY published_at DESC`,
    [from],
  );
  return result.rows.map((row) => ({ title: row.title, publishedAt: row.published_at }));
}

export async function buildDigest(
  pool: pg.Pool,
  now: Date,
  settings: DeskSettings = DEFAULT_DESK_SETTINGS,
  snapshot?: FeatureSnapshot | null,
): Promise<DigestReport> {
  const from = digestWindowStart(now);
  const [alerts, items] = await Promise.all([loadDigestAlerts(pool, from), loadDigestItems(pool, from)]);
  return buildDigestReport({ now, alerts, items, settings, snapshot });
}
