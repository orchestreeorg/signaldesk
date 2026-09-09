import type { Asset } from "../../domain/index.js";
import { canonicalizeKey } from "../../domain/index.js";
import type { Database } from "../../db/client.js";
import { upsertEvent } from "../../db/events.js";
import { collapseRawItems } from "./collapse.js";
import { parseFarsideHtml } from "./parseFarside.js";
import { parseFeed } from "./parseRss.js";
import { simhash64 } from "./simhash.js";
import type { NewsSource } from "./sources.js";
import type { RawItem } from "./types.js";

function inferAssets(text: string): Asset[] {
  const upper = text.toUpperCase();
  const assets: Asset[] = [];
  if (upper.includes("BTC") || upper.includes("BITCOIN")) {
    assets.push("BTC");
  }
  if (upper.includes("ETH") || upper.includes("ETHEREUM")) {
    assets.push("ETH");
  }
  return assets.length > 0 ? assets : ["BTC", "ETH"];
}

export function toRawItem(source: NewsSource, parsed: { url: string; title: string; body: string; publishedAt: Date }): RawItem {
  const body = parsed.body || parsed.title;
  return {
    sourceId: source.id,
    sourceRank: source.rank,
    url: canonicalizeKey(parsed.url),
    title: parsed.title,
    body,
    publishedAt: parsed.publishedAt,
    simhash: simhash64(body),
  };
}

export function ingestFeedXml(source: NewsSource, xml: string): RawItem[] {
  return ingestFeed(source, xml);
}

export function ingestFeed(source: NewsSource, body: string): RawItem[] {
  if (source.kind === "esplora") {
    throw new Error("esplora sources must use ingestEsplora, not ingestFeed");
  }
  const parsed = source.kind === "html" ? parseFarsideHtml(body, source.url) : parseFeed(body);
  return collapseRawItems(parsed.map((item) => toRawItem(source, item)));
}

export async function persistEventShells(db: Database, items: RawItem[]) {
  const events = [];
  for (const item of items) {
    const event = await upsertEvent(db, {
      class: "OTHER",
      assets: inferAssets(`${item.title} ${item.body}`),
      source: item.sourceId,
      url: item.url,
      novelty: 0,
      credibility: item.sourceRank / 100,
      polarity: 0,
      occurredAt: item.publishedAt,
    });
    events.push(event);
  }
  return events;
}
