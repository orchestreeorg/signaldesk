import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("fusion isolation", () => {
  it("does not send Telegram; policy is the only sender", () => {
    const fuse = readFileSync(join(here, "../../src/fusion/fuse.ts"), "utf8");
    const policy = readFileSync(join(here, "../../src/policy/emit.ts"), "utf8");
    expect(fuse).not.toMatch(/sendAlert|grammy|telegram/);
    expect(fuse).not.toMatch(/sendMacroIndex|emitMacroIndex|macroHourly/);
    expect(fuse).not.toMatch(/sendNearPosition|emitNearPosition|nearHourly/);
    expect(fuse).not.toMatch(/nearNote|NEAR_NOTE_SYSTEM_PROMPT|completeChat/);
    expect(fuse).not.toMatch(/nearLots|loadNearNews|nearDesk|nearSimulate|nearChart|nearAth|recordNearAth/);
    expect(policy).toMatch(/sendAlert/);
  });
});
