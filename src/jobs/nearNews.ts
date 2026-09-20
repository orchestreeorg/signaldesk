import { fetchUrl } from "../collectors/news/poll.js";
import { parseFeed } from "../collectors/news/parseRss.js";
import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import type { DeskSettings } from "../desk/types.js";
import { headlineTone, type HeadlineTone } from "../telegram/tone.js";

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export const NEAR_NEWS_TTL_MS = 10 * 60_000;
export const NEAR_NEWS_ERROR_TTL_MS = 60_000;
export const NEAR_HEADLINE_LIMIT = 40;

export type NearNewsSource = {
  id: string;
  name: string;
  url: string;
  dedicated: boolean;
};

export const NEAR_NEWS_SOURCES: NearNewsSource[] = [
  {
    id: "near-gov",
    name: "NEAR Forum",
    url: "https://gov.near.org/latest.rss",
    dedicated: true,
  },
  {
    id: "near-gnews",
    name: "Google News",
    url: "https://news.google.com/rss/search?q=NEAR+Protocol+crypto&hl=en-US&gl=US&ceid=US:en",
    dedicated: true,
  },
  {
    id: "coindesk",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    dedicated: false,
  },
  {
    id: "theblock",
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    dedicated: false,
  },
];

export type NearHeadline = {
  title: string;
  url: string;
  href: string | null;
  sourceId: string;
  sourceName: string;
  publishedAt: string;
  tone: HeadlineTone;
};

type CacheEntry = {
  at: number;
  value: NearHeadline[];
  ttlMs: number;
};

let cache: CacheEntry | null = null;

export function resetNearNewsCache(): void {
  cache = null;
}

/** Ticker/name only. Does not match the English word "near". */
export function isNearStory(text: string): boolean {
  return /\bNEAR\b/.test(text) || /Near Protocol/i.test(text) || /\$NEAR\b/.test(text);
}

export function headlinesFromFeed(
  source: NearNewsSource,
  xml: string,
  settings: DeskSettings = DEFAULT_DESK_SETTINGS,
): NearHeadline[] {
  const rows: NearHeadline[] = [];
  for (const item of parseFeed(xml)) {
    if (!item.title || !item.url) {
      continue;
    }
    const blob = `${item.title}\n${item.body}`;
    if (!source.dedicated && !isNearStory(blob)) {
      continue;
    }
    const publishedAt = Number.isNaN(item.publishedAt.getTime()) ? new Date(0) : item.publishedAt;
    rows.push({
      title: item.title,
      url: item.url,
      href: safeHref(item.url),
      sourceId: source.id,
      sourceName: source.name,
      publishedAt: publishedAt.toISOString(),
      tone: headlineTone(item.title, settings),
    });
  }
  return rows;
}

export function mergeNearHeadlines(rows: NearHeadline[], limit = NEAR_HEADLINE_LIMIT): NearHeadline[] {
  const seen = new Set<string>();
  const merged: NearHeadline[] = [];
  for (const row of [...rows].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const key = row.url || row.title;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(row);
    if (merged.length >= limit) {
      break;
    }
  }
  return merged;
}

export async function loadNearNews(input?: {
  now?: Date;
  settings?: DeskSettings;
  fetchXml?: (url: string, sourceId: string) => Promise<string>;
}): Promise<NearHeadline[]> {
  const now = input?.now ?? new Date();
  if (cache && now.getTime() - cache.at < cache.ttlMs) {
    return cache.value;
  }
  const settings = input?.settings ?? DEFAULT_DESK_SETTINGS;
  const fetchXml = input?.fetchXml ?? ((url: string, sourceId: string) => fetchUrl(url, sourceId));
  const collected: NearHeadline[] = [];
  await Promise.all(
    NEAR_NEWS_SOURCES.map(async (source) => {
      try {
        const xml = await fetchXml(source.url, source.id);
        collected.push(...headlinesFromFeed(source, xml, settings));
      } catch {
        // One feed down should not blank the blotter.
      }
    }),
  );
  const value = mergeNearHeadlines(collected);
  cache = {
    at: now.getTime(),
    value,
    ttlMs: value.length > 0 ? NEAR_NEWS_TTL_MS : NEAR_NEWS_ERROR_TTL_MS,
  };
  return value;
}
