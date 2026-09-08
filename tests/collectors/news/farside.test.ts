import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ingestFeed } from "../../../src/collectors/news/ingest.js";
import { parseFarsideHtml } from "../../../src/collectors/news/parseFarside.js";
import { sourceById } from "../../../src/collectors/news/sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "../../fixtures/news/farside-btc.html"), "utf8");

describe("farside html", () => {
  it("uses the live BTC table URL", () => {
    const source = sourceById("farside");
    expect(source?.url).toBe("https://farside.co.uk/btc/");
    expect(source?.kind).toBe("html");
    expect(source?.url).not.toMatch(/bitcoin_etf\.xml/);
  });

  it("turns the latest daily total into one ETF item", () => {
    const items = parseFarsideHtml(html, "https://farside.co.uk/btc/");
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("inflow $174.6m");
    expect(items[0]?.url).toContain("as_of=2026-09-04");
    expect(items[0]?.title).not.toContain("08 Sep");
  });

  it("ingests through the news poll path", () => {
    const source = sourceById("farside");
    if (!source) {
      throw new Error("missing farside");
    }
    const items = ingestFeed(source, html);
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceId).toBe("farside");
    expect(items[0]?.title).toMatch(/ETF inflow/);
  });
});
