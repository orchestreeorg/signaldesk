import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("news isolation", () => {
  it("does not send Telegram", () => {
    const files = ["collector.ts", "poll.ts", "ingest.ts", "parseFarside.ts"].map((name) =>
      readFileSync(join(here, "../../../src/collectors/news", name), "utf8"),
    );
    expect(files.join("\n")).not.toMatch(/sendAlert|telegram|grammy/i);
  });
});
