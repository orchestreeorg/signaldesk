import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isNearJob } from "../../src/jobs/schedule.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("hourly NEAR position job", () => {
  it("treats NEAR digest-queue jobs as the position path", () => {
    expect(isNearJob({ name: "near", data: { kind: "NEAR" } })).toBe(true);
    expect(isNearJob({ name: "near-now", data: { kind: "NEAR" } })).toBe(true);
    expect(isNearJob({ name: "macro", data: { kind: "MACRO" } })).toBe(false);
    expect(isNearJob({ name: "news", data: { kind: "news" } })).toBe(false);
    expect(isNearJob({ name: "digest", data: { kind: "DIGEST" } })).toBe(false);
  });

  it("sends through the dedicated Telegram path, not Policy or fusion", () => {
    const src = readFileSync(join(here, "../../src/jobs/nearHourly.ts"), "utf8");
    expect(src).toMatch(/listNearLots/);
    expect(src).toMatch(/loadNearPrice/);
    expect(src).toMatch(/sendNearPosition/);
    expect(src).not.toMatch(/loadNearNews|tapePolarity|fuse\(|sendAlert|sendDigest|sendHeadline|sendMacroIndex/);
  });
});
