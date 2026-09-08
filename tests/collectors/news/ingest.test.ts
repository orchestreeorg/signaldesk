import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collapseRawItems } from "../../../src/collectors/news/collapse.js";
import { ingestFeedXml } from "../../../src/collectors/news/ingest.js";
import { NEWS_SOURCES, sourceById } from "../../../src/collectors/news/sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const xml = (name: string) => readFileSync(join(here, "../../fixtures/news", name), "utf8");

describe("news ingest", () => {
  it("keeps source rank as a numeric table", () => {
    expect(NEWS_SOURCES.every((source) => Number.isFinite(source.rank))).toBe(true);
    expect(sourceById("fed")?.rank).toBeGreaterThan(sourceById("coindesk")?.rank ?? 0);
  });

  it("collapses two rewritten headlines of one story into one RawItem", () => {
    const coindesk = sourceById("coindesk");
    const theblock = sourceById("theblock");
    if (!coindesk || !theblock) {
      throw new Error("missing sources");
    }
    const a = ingestFeedXml(coindesk, xml("same-story-a.xml"));
    const b = ingestFeedXml(theblock, xml("same-story-b.xml"));
    const collapsed = collapseRawItems([...a, ...b]);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.title).toContain("withdrawals");
  });
});
