import { collapseRawItems } from "./collapse.js";
import { ingestFeed } from "./ingest.js";
import { NEWS_SOURCES, type NewsSource } from "./sources.js";
import type { RawItem } from "./types.js";

export const NEWS_USER_AGENT = "signal-desk/0.0.1 (research desk)";

export type FetchXml = (source: NewsSource) => Promise<string>;

export async function fetchFeedXml(
  source: NewsSource,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(source.url, {
    headers: { "user-agent": NEWS_USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${source.id} HTTP ${response.status}`);
  }
  return response.text();
}

export async function pollNews(opts?: {
  sources?: NewsSource[];
  fetchXml?: FetchXml;
}): Promise<RawItem[]> {
  const sources = opts?.sources ?? NEWS_SOURCES;
  const fetchXml = opts?.fetchXml ?? fetchFeedXml;
  const items: RawItem[] = [];
  for (const source of sources) {
    try {
      items.push(...ingestFeed(source, await fetchXml(source)));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`news: skip ${source.id}: ${message}`);
    }
  }
  return collapseRawItems(items);
}
