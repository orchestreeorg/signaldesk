import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { runSmoke } from "../../src/jobs/smoke.js";
import { ChatStore } from "../../src/telegram/store.js";

describe("smoke", () => {
  it("sends dummy FLASH then DIGEST through sendAlert", async () => {
    const sent: string[] = [];
    const result = await runSmoke(
      loadConfig({
        DATABASE_URL: "postgres://signal:signal@127.0.0.1:5433/signal",
        REDIS_URL: "redis://localhost:6379",
        TELEGRAM_BOT_TOKEN: "0:stub",
        TELEGRAM_CHAT_ID: "99",
        TELEGRAM_DRY_RUN: "0",
      }),
      {
        store: new ChatStore(),
        transport: {
          async send(_chat: string, html: string) {
            sent.push(html);
          },
        },
      },
    );
    expect(result.flash.sent).toBe(true);
    expect(result.digest.sent).toBe(true);
    expect(sent[0]).toContain("FLASH BTC");
    expect(sent[1]).toContain("DIGEST BTC");
  });

  it("stays dry-run when TELEGRAM_DRY_RUN is on", async () => {
    const result = await runSmoke(
      loadConfig({
        DATABASE_URL: "postgres://signal:signal@127.0.0.1:5433/signal",
        REDIS_URL: "redis://localhost:6379",
        TELEGRAM_CHAT_ID: "1",
      }),
      { transport: { async send() {} } },
    );
    expect(result.flash).toMatchObject({ sent: false, reason: "dry-run" });
    expect(result.digest).toMatchObject({ sent: false, reason: "dry-run" });
  });
});
