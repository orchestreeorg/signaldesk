import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNewsCollector } from "../../../src/collectors/news/collector.js";
import { pollNews } from "../../../src/collectors/news/poll.js";
import { sourceById } from "../../../src/collectors/news/sources.js";

const here = dirname(fileURLToPath(import.meta.url));
const xml = (name: string) => readFileSync(join(here, "../../fixtures/news", name), "utf8");

describe("news poll", () => {
  it("ingests live feeds through an injected fetch", async () => {
    const coindesk = sourceById("coindesk");
    if (!coindesk) {
      throw new Error("missing source");
    }
    const items = await pollNews({
      sources: [coindesk],
      fetchXml: async () => xml("same-story-a.xml"),
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("withdrawals");
  });

  it("does not fetch when the collector is not live", async () => {
    let hits = 0;
    const collector = createNewsCollector({
      live: false,
      fetchXml: async () => {
        hits += 1;
        return xml("same-story-a.xml");
      },
    });
    await collector.run({ now: new Date() });
    expect(hits).toBe(0);
  });
});
