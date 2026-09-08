import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");

describe("secrets", () => {
  it("keeps .env out of git and example empty", () => {
    const ignore = readFileSync(join(root, ".gitignore"), "utf8");
    const example = readFileSync(join(root, ".env.example"), "utf8");
    expect(ignore).toMatch(/^\.env$/m);
    expect(example).toMatch(/TELEGRAM_BOT_TOKEN=$/m);
    expect(example).toMatch(/TELEGRAM_DRY_RUN=1/);
    expect(example).not.toMatch(/\d{8,}:[A-Za-z0-9_-]{20,}/);
  });
});
