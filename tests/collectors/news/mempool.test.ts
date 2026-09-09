import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ingestFeed } from "../../../src/collectors/news/ingest.js";
import {
  formatBtcAmount,
  parseLargeTxPrints,
  SATS_PER_BTC,
  thresholdSats,
} from "../../../src/collectors/news/parseMempool.js";
import { pollNews } from "../../../src/collectors/news/poll.js";
import { sourceById } from "../../../src/collectors/news/sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(join(here, "../../fixtures/news", name), "utf8")) as unknown;

const txs = fixture("esplora-txs.json");
const blocks = fixture("esplora-blocks.json");

function parseFixture() {
  return parseLargeTxPrints(txs, {
    explorerOrigin: "https://mempool.space",
    height: 900001,
    timestamp: 1757347200,
    thresholdSats: thresholdSats(1000),
  });
}

describe("mempool large tx parse", () => {
  it("keeps one print per txid for a single output at or above 1000 BTC", () => {
    const prints = parseFixture();
    expect(prints.map((item) => item.title)).toEqual([
      "Large BTC transfer: 1,500 BTC",
      "Large BTC transfer: 1,200 BTC",
    ]);
    expect(prints[0]?.url).toBe(
      "https://mempool.space/tx/aa11large1500aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(prints[1]?.body).toContain("block 900001");
    expect(prints[1]?.body).toContain("dd44twolarge");
  });

  it("ignores sub-threshold outputs and coinbase", () => {
    const prints = parseFixture();
    expect(prints.some((item) => item.url.includes("bb22small200"))).toBe(false);
    expect(prints.some((item) => item.url.includes("cc33coinbase"))).toBe(false);
  });

  it("does not emit two items when one tx has two large outputs", () => {
    const prints = parseFixture().filter((item) => item.url.includes("dd44twolarge"));
    expect(prints).toHaveLength(1);
    expect(prints[0]?.title).toContain("1,200 BTC");
  });

  it("formats whole and tenths of a BTC", () => {
    expect(formatBtcAmount(1240 * SATS_PER_BTC)).toBe("1,240 BTC");
    expect(formatBtcAmount(124_040_000_000)).toBe("1,240.4 BTC");
  });
});

describe("mempool poll", () => {
  it("ingests through injected json and never hits RSS ingest", async () => {
    const mempool = sourceById("mempool");
    if (!mempool) {
      throw new Error("missing mempool");
    }
    const items = await pollNews({
      sources: [mempool],
      fetchXml: async () => {
        throw new Error("rss should not run for esplora");
      },
      fetchJson: async (url) => {
        if (url.endsWith("/blocks")) {
          return blocks;
        }
        if (url.includes("/block/blocktip/txs")) {
          return txs;
        }
        return [];
      },
    });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.sourceId === "mempool")).toBe(true);
    expect(items[0]?.url).toContain("https://mempool.space/tx/");
  });

  it("does not fetch esplora when the source is omitted", async () => {
    const coindesk = sourceById("coindesk");
    if (!coindesk) {
      throw new Error("missing coindesk");
    }
    let jsonHits = 0;
    const items = await pollNews({
      sources: [coindesk],
      fetchXml: async () =>
        readFileSync(join(here, "../../fixtures/news/same-story-a.xml"), "utf8"),
      fetchJson: async () => {
        jsonHits += 1;
        return [];
      },
    });
    expect(jsonHits).toBe(0);
    expect(items).toHaveLength(1);
  });

  it("caps mempool prints so a burst cannot starve the batch", async () => {
    const mempool = sourceById("mempool");
    if (!mempool) {
      throw new Error("missing mempool");
    }
    const many = Array.from({ length: 8 }, (_, index) => ({
      txid: `ff${index.toString().padStart(62, "0")}`,
      vin: [{ is_coinbase: false }],
      vout: [{ value: (2000 - index) * SATS_PER_BTC }],
    }));
    const items = await pollNews({
      sources: [mempool],
      fetchJson: async (url) => {
        if (url.endsWith("/blocks")) {
          return [{ id: "blocktip", height: 900001, timestamp: 1757347200 }];
        }
        return many;
      },
    });
    expect(items).toHaveLength(5);
    expect(items[0]?.title).toContain("2,000 BTC");
  });

  it("skips the source when json fetch fails", async () => {
    const mempool = sourceById("mempool");
    if (!mempool) {
      throw new Error("missing mempool");
    }
    const items = await pollNews({
      sources: [mempool],
      fetchJson: async () => {
        throw new Error("esplora down");
      },
    });
    expect(items).toEqual([]);
  });

  it("refuses to parse esplora as a feed", () => {
    const mempool = sourceById("mempool");
    if (!mempool) {
      throw new Error("missing mempool");
    }
    expect(() => ingestFeed(mempool, "[]")).toThrow(/ingestEsplora/);
  });
});
