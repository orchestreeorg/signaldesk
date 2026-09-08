import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("ops isolation", () => {
  it("does not send Telegram", () => {
    const names = ["log.ts", "bus.ts", "clock.ts", "types.ts"];
    const src = names.map((name) => readFileSync(join(here, "../../src/ops", name), "utf8")).join("\n");
    expect(src).not.toMatch(/sendAlert|telegram|grammy/i);
  });
});
