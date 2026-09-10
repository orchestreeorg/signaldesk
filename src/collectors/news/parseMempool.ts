import { toRawItem } from "./ingest.js";
import type { ParsedFeedItem } from "./parseRss.js";
import type { NewsSource } from "./sources.js";
import type { RawItem } from "./types.js";

export const SATS_PER_BTC = 100_000_000;
export const DEFAULT_BTC_LARGE_TX_BTC = 5000;
export const DEFAULT_MEMPOOL_API_BASE = "https://mempool.space/api";
export const MEMPOOL_MAX_BLOCKS = 3;
export const MEMPOOL_ITEM_CAP = 5;
export const MEMPOOL_TX_PAGE_SIZE = 25;
export const MEMPOOL_MAX_TX_PAGES = 40;

export type FetchJson = (url: string) => Promise<unknown>;

export type EsploraBlock = {
  id?: string;
  height?: number;
  timestamp?: number;
};

export type EsploraTx = {
  txid?: string;
  vin?: Array<{ is_coinbase?: boolean }>;
  vout?: Array<{ value?: number }>;
};

export type LargeTxPrint = ParsedFeedItem & { sats: number };

export function thresholdSats(btc: number): number {
  return Math.round(btc * SATS_PER_BTC);
}

export function explorerOrigin(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, "");
  return trimmed.replace(/\/api$/i, "") || "https://mempool.space";
}

export function formatBtcAmount(sats: number): string {
  const rounded = Math.round((sats / SATS_PER_BTC) * 10) / 10;
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
  return `${formatted} BTC`;
}

export function isCoinbaseTx(tx: EsploraTx): boolean {
  return tx.vin?.[0]?.is_coinbase === true;
}

export function largestOutputSats(tx: EsploraTx): number {
  let max = 0;
  for (const output of tx.vout ?? []) {
    const value = Number(output.value);
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max;
}

export function parseEsploraBlocks(raw: unknown): EsploraBlock[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((row): row is EsploraBlock => Boolean(row && typeof row === "object"));
}

export function parseLargeTxPrints(
  txs: unknown,
  opts: {
    explorerOrigin: string;
    height: number;
    timestamp: number;
    thresholdSats: number;
  },
): LargeTxPrint[] {
  if (!Array.isArray(txs)) {
    return [];
  }
  const publishedAt = new Date(opts.timestamp * 1000);
  const prints: LargeTxPrint[] = [];
  const seen = new Set<string>();
  for (const row of txs) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const tx = row as EsploraTx;
    const txid = typeof tx.txid === "string" ? tx.txid : "";
    if (!txid || seen.has(txid) || isCoinbaseTx(tx)) {
      continue;
    }
    const sats = largestOutputSats(tx);
    if (sats < opts.thresholdSats) {
      continue;
    }
    seen.add(txid);
    const amount = formatBtcAmount(sats);
    prints.push({
      url: `${opts.explorerOrigin.replace(/\/+$/, "")}/tx/${txid}`,
      title: `Large BTC transfer: ${amount}`,
      body: `${amount} on-chain. tx ${txid}. block ${opts.height}.`,
      publishedAt,
      sats,
    });
  }
  return prints;
}

export async function ingestEsplora(
  source: NewsSource,
  opts: {
    fetchJson: FetchJson;
    apiBase?: string;
    thresholdBtc?: number;
    maxBlocks?: number;
    maxItems?: number;
  },
): Promise<RawItem[]> {
  const apiBase = (opts.apiBase ?? source.url).replace(/\/+$/, "");
  const thresholdBtc = opts.thresholdBtc ?? DEFAULT_BTC_LARGE_TX_BTC;
  const maxBlocks = opts.maxBlocks ?? MEMPOOL_MAX_BLOCKS;
  const maxItems = opts.maxItems ?? MEMPOOL_ITEM_CAP;
  const origin = explorerOrigin(apiBase);
  const minSats = thresholdSats(thresholdBtc);

  const blocks = parseEsploraBlocks(await opts.fetchJson(`${apiBase}/blocks`)).slice(0, maxBlocks);
  const prints: LargeTxPrint[] = [];
  for (const block of blocks) {
    const hash = block.id;
    const height = Number(block.height);
    const timestamp = Number(block.timestamp);
    if (!hash || !Number.isFinite(height) || !Number.isFinite(timestamp)) {
      continue;
    }
    const txs: unknown[] = [];
    for (let page = 0; page < MEMPOOL_MAX_TX_PAGES; page += 1) {
      const start = page * MEMPOOL_TX_PAGE_SIZE;
      const url = start === 0 ? `${apiBase}/block/${hash}/txs` : `${apiBase}/block/${hash}/txs/${start}`;
      const chunk = await opts.fetchJson(url);
      if (!Array.isArray(chunk) || chunk.length === 0) {
        break;
      }
      txs.push(...chunk);
      if (chunk.length < MEMPOOL_TX_PAGE_SIZE) {
        break;
      }
    }
    prints.push(
      ...parseLargeTxPrints(txs, {
        explorerOrigin: origin,
        height,
        timestamp,
        thresholdSats: minSats,
      }),
    );
  }

  prints.sort((a, b) => {
    const byTime = b.publishedAt.getTime() - a.publishedAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    return b.sats - a.sats;
  });

  return prints.slice(0, maxItems).map((print) => toRawItem(source, print));
}
