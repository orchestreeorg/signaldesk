import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { startBot } from "../../src/processes/bot.js";

const here = dirname(fileURLToPath(import.meta.url));
const botSource = readFileSync(join(here, "../../src/processes/bot.ts"), "utf8");

describe("bot process", () => {
  it("imports telegram only", () => {
    expect(botSource).toMatch(/from "\.\.\/telegram\/index\.js"/);
    expect(botSource).not.toMatch(/collectors/);
    expect(botSource).not.toMatch(/fusion/);
    expect(botSource).not.toMatch(/from "\.\.\/queue/);
  });

  it("starts without polling when dry-run", async () => {
    await expect(
      startBot(
        loadConfig({
          DATABASE_URL: "postgres://signal:signal@127.0.0.1:5433/signal",
          REDIS_URL: "redis://localhost:6379",
          TELEGRAM_DRY_RUN: "1",
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
