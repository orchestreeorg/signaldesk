import type pg from "pg";
import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import { loadDeskSettings } from "../desk/settings.js";
import {
  insertNearLot,
  listNearLots,
  parseNearLot,
  summarizeNearLots,
  type NearLot,
  type NearLotInput,
  type NearPosition,
} from "./nearLots.js";
import { loadNearNews, type NearHeadline } from "./nearNews.js";
import { loadNearPrice, type NearQuote } from "./nearPrice.js";

export type NearDeskReport = {
  now: Date;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  headlines: NearHeadline[];
};

export function serializeNearDesk(report: NearDeskReport) {
  return {
    now: report.now.toISOString(),
    quote: report.quote,
    position: report.position,
    lots: report.lots.map((lot) => ({
      id: lot.id,
      side: lot.side,
      at: lot.at.toISOString(),
      tokens: lot.tokens,
      value: lot.value,
    })),
    headlines: report.headlines,
  };
}

export async function buildNearDesk(pool: pg.Pool, now = new Date()): Promise<NearDeskReport> {
  let settings = DEFAULT_DESK_SETTINGS;
  try {
    settings = await loadDeskSettings(pool);
  } catch {
    // Tone defaults still classify headlines if desk_settings is missing.
  }
  const lots = await listNearLots(pool);
  const [headlines, quote] = await Promise.all([
    loadNearNews({ now, settings }),
    loadNearPrice({ now }),
  ]);
  return {
    now,
    quote,
    position: summarizeNearLots(lots),
    lots,
    headlines,
  };
}

export async function addNearLot(pool: pg.Pool, raw: unknown): Promise<NearLot | { error: string }> {
  const parsed = parseNearLot(raw);
  if ("error" in parsed) {
    return parsed;
  }
  return insertNearLot(pool, parsed);
}

export type { NearLot, NearLotInput, NearPosition };
