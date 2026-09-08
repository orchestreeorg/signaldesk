import { describe, expect, it } from "vitest";
import { pickNewRawItems } from "../../../src/collectors/news/store.js";
import type { RawItem } from "../../../src/collectors/news/types.js";

function item(partial: Partial<RawItem> & Pick<RawItem, "url" | "simhash" | "publishedAt">): RawItem {
  return {
    sourceId: "coindesk",
    sourceRank: 70,
    title: partial.url,
    body: partial.url,
    ...partial,
  };
}

describe("pickNewRawItems", () => {
  it("keeps the newest stories first and honors the batch cap", () => {
    const older = item({
      url: "https://example.com/old",
      simhash: "0000000000000000",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = item({
      url: "https://example.com/new",
      simhash: "ffffffffffffffff",
      publishedAt: new Date("2026-09-08T00:00:00.000Z"),
    });
    const picked = pickNewRawItems([older, newer], [], 1);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.url).toBe("https://example.com/new");
  });

  it("skips stories already stored", () => {
    const raw = item({
      url: "https://example.com/same",
      simhash: "1",
      publishedAt: new Date("2026-09-08T00:00:00.000Z"),
    });
    expect(pickNewRawItems([raw], [raw], 12)).toEqual([]);
  });
});
