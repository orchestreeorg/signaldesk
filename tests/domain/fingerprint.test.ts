import { describe, expect, it } from "vitest";
import {
  COLLAPSE_WINDOW_MS,
  canonicalizeKey,
  fingerprint,
} from "../../src/domain/index.js";

const base = {
  class: "EXCHANGE_STRESS" as const,
  asset: "BTC" as const,
  canonicalKey: "https://Example.com/story/",
};

describe("fingerprint", () => {
  it("reuses the same fingerprint inside the 30-minute window", () => {
    const start = new Date("2026-09-07T12:00:00.000Z");
    const later = new Date(start.getTime() + COLLAPSE_WINDOW_MS - 1);
    expect(fingerprint({ ...base, at: start })).toBe(fingerprint({ ...base, at: later }));
  });

  it("issues a new fingerprint after the window", () => {
    const start = new Date("2026-09-07T12:00:00.000Z");
    const next = new Date(start.getTime() + COLLAPSE_WINDOW_MS);
    expect(fingerprint({ ...base, at: start })).not.toBe(fingerprint({ ...base, at: next }));
  });

  it("canonicalizes URLs before hashing", () => {
    const at = new Date("2026-09-07T12:00:00.000Z");
    const a = fingerprint({ ...base, at, canonicalKey: "https://example.com/story" });
    const b = fingerprint({ ...base, at, canonicalKey: "https://Example.com/story/#frag" });
    expect(a).toBe(b);
    expect(canonicalizeKey("https://Example.com/story/")).toBe("https://example.com/story");
  });
});
