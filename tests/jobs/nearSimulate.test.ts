import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { simulateNearHoldingsUsd } from "../../src/jobs/nearSimulate.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("NEAR price simulator", () => {
  it("marks current holdings at a user price", () => {
    expect(simulateNearHoldingsUsd(13865, 4.2)).toBe(58233);
    expect(simulateNearHoldingsUsd(100, 2.5)).toBe(250);
    expect(simulateNearHoldingsUsd(0, 4)).toBe(0);
  });

  it("rejects a missing or non-positive mark", () => {
    expect(simulateNearHoldingsUsd(100, 0)).toBeNull();
    expect(simulateNearHoldingsUsd(100, -1)).toBeNull();
    expect(simulateNearHoldingsUsd(100, Number.NaN)).toBeNull();
  });

  it("does not send Telegram or touch fusion", () => {
    const sim = readFileSync(join(here, "../../src/jobs/nearSimulate.ts"), "utf8");
    const ui = readFileSync(join(here, "../../dashboard/app/near/NearPriceSimulator.tsx"), "utf8");
    expect(sim).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity|fuse\(/i);
    expect(ui).not.toMatch(/sendAlert|sendDigest|sendHeadline|grammy|tapePolarity|fuse\(/i);
  });
});
