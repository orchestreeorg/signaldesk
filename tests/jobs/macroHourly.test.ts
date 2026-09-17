import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isMacroJob } from "../../src/jobs/schedule.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("hourly macro index job", () => {
  it("treats MACRO digest-queue jobs as the index path", () => {
    expect(isMacroJob({ name: "macro", data: { kind: "MACRO" } })).toBe(true);
    expect(isMacroJob({ name: "macro-now", data: { kind: "MACRO" } })).toBe(true);
    expect(isMacroJob({ name: "digest", data: { kind: "DIGEST" } })).toBe(false);
    expect(isMacroJob({ name: "digest-now", data: { kind: "digest" } })).toBe(false);
  });

  it("sends through Telegram, not Policy or fusion", () => {
    const src = readFileSync(join(here, "../../src/jobs/macroHourly.ts"), "utf8");
    expect(src).toMatch(/buildOverview/);
    expect(src).toMatch(/sendMacroIndex/);
    expect(src).not.toMatch(/tapePolarity|fuse\(|sendAlert|sendDigest/);
  });
});
