import { spawn } from "node:child_process";
import { collapseRawItems } from "./collapse.js";
import { ingestFeed } from "./ingest.js";
import { NEWS_SOURCES, type NewsSource } from "./sources.js";
import type { RawItem } from "./types.js";

export const NEWS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const NEWS_HEADERS: Record<string, string> = {
  "user-agent": NEWS_USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-GB,en;q=0.9",
};

export type FetchXml = (source: NewsSource) => Promise<string>;

export async function curlGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("curl", [
      "-fsSL",
      "--max-time",
      "20",
      "-A",
      NEWS_USER_AGENT,
      "-H",
      `Accept: ${NEWS_HEADERS.accept}`,
      "-H",
      `Accept-Language: ${NEWS_HEADERS["accept-language"]}`,
      url,
    ]);
    const chunks: Buffer[] = [];
    const err: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      err.push(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        return;
      }
      const detail = Buffer.concat(err).toString("utf8").trim().slice(0, 200);
      reject(new Error(detail || `curl exit ${code}`));
    });
  });
}

export async function fetchFeedXml(
  source: NewsSource,
  fetchImpl: typeof fetch = fetch,
  fallbackGet: (url: string) => Promise<string> = curlGet,
): Promise<string> {
  const response = await fetchImpl(source.url, {
    headers: NEWS_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) {
    return response.text();
  }
  if (response.status === 403 || response.status === 503) {
    return fallbackGet(source.url);
  }
  throw new Error(`${source.id} HTTP ${response.status}`);
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
