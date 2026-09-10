import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const validEnv = {
    DATABASE_URL: "postgres://signal:signal@127.0.0.1:5433/signal",
  REDIS_URL: "redis://localhost:6379",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
} satisfies NodeJS.ProcessEnv;

describe("loadConfig", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("parses a valid env", () => {
    const config = loadConfig(validEnv);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(config.REDIS_URL).toBe(validEnv.REDIS_URL);
    expect(config.TELEGRAM_BOT_TOKEN).toBe("");
    expect(config.TELEGRAM_CHAT_ID).toBe("");
    expect(config.TELEGRAM_DRY_RUN).toBe(true);
    expect(config.NEWS_LIVE).toBe(false);
    expect(config.TAPE_LIVE).toBe(false);
    expect(config.BTC_LARGE_TX_BTC).toBe(5000);
    expect(config.MEMPOOL_API_BASE).toBe("https://mempool.space/api");
  });

  it("rejects an invalid large-tx threshold", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        BTC_LARGE_TX_BTC: "nope",
      }),
    ).toThrow(/BTC_LARGE_TX_BTC/);
  });

  it("throws when DATABASE_URL is missing", () => {
    expect(() =>
      loadConfig({
        REDIS_URL: validEnv.REDIS_URL,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("defaults TELEGRAM_DRY_RUN to true", () => {
    const config = loadConfig({
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
    });
    expect(config.TELEGRAM_DRY_RUN).toBe(true);
  });
});
