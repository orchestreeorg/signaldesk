import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("features isolation", () => {
  it("does not import telegram or send alerts", () => {
    const snapshot = readFileSync(join(here, "../../src/features/snapshot.ts"), "utf8");
    const flows = readFileSync(join(here, "../../src/features/flows.ts"), "utf8");
    expect(snapshot + flows).not.toMatch(/telegram|sendAlert|FLASH/i);
    expect(flows).toMatch(/Do not invent/);
  });
});
