import { spawn } from "node:child_process";
import { ops } from "../../ops/log.js";
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

function isAbort(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "TimeoutError" || error.name === "AbortError" || /aborted|timeout/i.test(error.message);
}

export async function fetchFeedXml(
  source: NewsSource,
  fetchImpl: typeof fetch = fetch,
  fallbackGet: (url: string) => Promise<string> = curlGet,
): Promise<string> {
  try {
    const response = await fetchImpl(source.url, {
      headers: NEWS_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      return response.text();
    }
    if (response.status === 403 || response.status === 503) {
      ops("news", "source.fallback", `Node fetch ${source.id} HTTP ${response.status}; retrying with curl`, {
        level: "warn",
        data: { sourceId: source.id, status: response.status },
      });
      return fallbackGet(source.url);
    }
    throw new Error(`${source.id} HTTP ${response.status}`);
  } catch (error: unknown) {
    if (isAbort(error)) {
      ops("news", "source.fallback", `Node fetch ${source.id} timed out; retrying with curl`, {
        level: "warn",
        data: { sourceId: source.id },
      });
      return fallbackGet(source.url);
    }
    throw error;
  }
}

export async function pollNews(opts?: {
  sources?: NewsSource[];
  fetchXml?: FetchXml;
}): Promise<RawItem[]> {
  const sources = opts?.sources ?? NEWS_SOURCES;
  const fetchXml = opts?.fetchXml ?? fetchFeedXml;
  const items: RawItem[] = [];
  ops("news", "round.start", `News poll starting (${sources.map((source) => source.id).join(", ")})`, {
    data: { sources: sources.map((source) => source.id) },
  });
  for (const source of sources) {
    ops("news", "source.fetch", `Fetching ${source.name}`, {
      data: { sourceId: source.id, url: source.url, kind: source.kind },
    });
    try {
      const ingested = ingestFeed(source, await fetchXml(source));
      items.push(...ingested);
      ops("news", "source.ok", `${source.id}: kept ${ingested.length} item(s)`, {
        level: "ok",
        data: { sourceId: source.id, items: ingested.length },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      ops("news", "source.skip", `Ignoring ${source.id}: ${message}`, {
        level: "skip",
        data: { sourceId: source.id, reason: message },
      });
    }
  }
  const collapsed = collapseRawItems(items);
  ops("news", "round.fetched", `Fetched ${items.length} raw, ${collapsed.length} after collapse`, {
    data: { raw: items.length, collapsed: collapsed.length },
  });
  return collapsed;
}
