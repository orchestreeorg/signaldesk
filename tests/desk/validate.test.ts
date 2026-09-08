import { describe, expect, it } from "vitest";
import { NEWS_SOURCES } from "../../src/collectors/news/sources.js";
import { DEFAULT_DESK_SETTINGS, SEED_NEWS_SOURCES } from "../../src/desk/defaults.js";
import { enabledSources } from "../../src/desk/settings.js";
import { parseDeskBundle, parseSources } from "../../src/desk/validate.js";

describe("desk parameters validation", () => {
  it("seeds the current five news sources", () => {
    expect(SEED_NEWS_SOURCES.map((source) => source.id)).toEqual(NEWS_SOURCES.map((source) => source.id));
    expect(SEED_NEWS_SOURCES).toHaveLength(5);
  });

  it("poll helper keeps only enabled sources", () => {
    const disabled = SEED_NEWS_SOURCES.map((source) => ({
      ...source,
      enabled: source.id === "coindesk",
    }));
    expect(enabledSources(disabled).map((source) => source.id)).toEqual(["coindesk"]);
  });

  it("rejects a missing source URL", () => {
    const parsed = parseSources([{ id: "x", name: "X", url: "", rank: 70, kind: "rss", enabled: true }]);
    expect(parsed).toEqual({ error: "source URL is required" });
  });

  it("rejects a rank outside 0–100", () => {
    const parsed = parseSources([
      { id: "x", name: "X", url: "https://example.com/rss", rank: 140, kind: "rss", enabled: true },
    ]);
    expect(parsed).toEqual({ error: "source rank must be between 0 and 100" });
  });

  it("accepts a full bundle", () => {
    const parsed = parseDeskBundle(
      { settings: DEFAULT_DESK_SETTINGS, sources: SEED_NEWS_SOURCES },
      DEFAULT_DESK_SETTINGS,
    );
    expect("error" in parsed).toBe(false);
  });
});
