import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const newsDir = join(here, "../../../src/collectors/news");

describe("news isolation", () => {
  it("does not send Telegram", () => {
    const files = readdirSync(newsDir)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => readFileSync(join(newsDir, name), "utf8"));
    expect(files.join("\n")).not.toMatch(/sendAlert|sendHeadline|telegram|grammy/i);
  });
});
