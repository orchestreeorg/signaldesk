import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("tape isolation", () => {
  it("does not import Telegram", () => {
    const names = ["collector.ts", "parse.ts", "live.ts", "runtime.ts", "stream.ts", "oi.ts"];
    const src = names.map((name) => readFileSync(join(here, "../../../src/collectors/tape", name), "utf8")).join("\n");
    expect(src).not.toMatch(/telegram|sendAlert|grammy/i);
  });
});
