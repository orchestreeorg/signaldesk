import type { RawItem } from "../collectors/news/types.js";
import type { NewEvent } from "../db/events.js";
import { fingerprint, type Asset } from "../domain/index.js";
import { credibilityOf } from "./credibility.js";
import { heuristicExtract } from "./heuristic.js";
import type { LlmClient } from "./llm.js";
import type { Classification } from "./types.js";
import { sanitizeExtract } from "./validate.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type NoveltyIndex = {
  seenInWindow(fingerprint: string, now: Date, windowMs?: number): boolean;
  remember?(fingerprint: string, at: Date): void;
};

export class MemoryNoveltyIndex implements NoveltyIndex {
  private readonly seen: Array<{ fingerprint: string; at: Date }> = [];

  seenInWindow(fp: string, now: Date, windowMs = DAY_MS): boolean {
    const from = now.getTime() - windowMs;
    return this.seen.some((row) => row.fingerprint === fp && row.at.getTime() >= from);
  }

  remember(fp: string, at: Date): void {
    this.seen.push({ fingerprint: fp, at });
  }
}

function inferAssets(text: string): Asset[] {
  const upper = text.toUpperCase();
  const assets: Asset[] = [];
  if (upper.includes("BTC") || upper.includes("BITCOIN")) {
    assets.push("BTC");
  }
  if (upper.includes("ETH") || upper.includes("ETHEREUM")) {
    assets.push("ETH");
  }
  return assets.length > 0 ? assets : ["BTC"];
}

export async function classifyRawItem(
  item: RawItem,
  llm: LlmClient,
  novelty: NoveltyIndex,
  now = item.publishedAt,
): Promise<Classification> {
  let extracted;
  try {
    extracted = sanitizeExtract(await llm.extract(item));
  } catch {
    extracted = sanitizeExtract(heuristicExtract(item));
  }
  const assets = extracted.assets.length > 0 ? extracted.assets : inferAssets(`${item.title} ${item.body}`);
  const scored = credibilityOf({
    sourceId: item.sourceId,
    sourceRank: item.sourceRank,
    class: extracted.class,
    title: item.title,
    body: item.body,
  });
  const primary = assets[0] ?? "BTC";
  const fp = fingerprint({
    class: scored.class,
    asset: primary,
    canonicalKey: item.url,
    at: now,
  });
  const noveltyScore = novelty.seenInWindow(fp, now) ? 0 : 1;
  return {
    class: scored.class,
    assets,
    polarity: extracted.polarity,
    novelty: noveltyScore,
    credibility: scored.credibility,
    summary: extracted.summary,
    isPrimary: scored.isPrimary,
    fingerprint: fp,
  };
}

export function toNewEvent(item: RawItem, classified: Classification): NewEvent {
  return {
    class: classified.class,
    assets: classified.assets,
    source: item.sourceId,
    url: item.url,
    novelty: classified.novelty,
    credibility: classified.credibility,
    polarity: classified.polarity,
    occurredAt: item.publishedAt,
  };
}
