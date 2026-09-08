import { ASSETS, EVENT_CLASSES, type Asset, type EventClass } from "../domain/index.js";
import type { LlmExtract } from "./types.js";

const CLASS_SET = new Set<string>(EVENT_CLASSES);
const ASSET_SET = new Set<string>(ASSETS);

const HOT_CLASSES = new Set<EventClass>([
  "HACK_VENUE",
  "HACK_PROTOCOL",
  "EXCHANGE_STRESS",
  "ENFORCEMENT",
]);

export function parseEventClass(value: string): EventClass {
  return CLASS_SET.has(value) ? (value as EventClass) : "OTHER";
}

export function parseAssets(values: string[]): Asset[] {
  const assets = values
    .map((value) => value.toUpperCase())
    .filter((value): value is Asset => ASSET_SET.has(value));
  return [...new Set(assets)];
}

export function clampPolarity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(-1, value));
}

export function isHotClass(value: EventClass): boolean {
  return HOT_CLASSES.has(value);
}

export function sanitizeExtract(raw: LlmExtract): {
  class: EventClass;
  assets: Asset[];
  polarity: number;
  summary: string;
} {
  return {
    class: parseEventClass(raw.class),
    assets: parseAssets(raw.assets),
    polarity: clampPolarity(raw.polarity),
    summary: raw.summary.trim().slice(0, 280),
  };
}
