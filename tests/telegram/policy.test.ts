import { describe, expect, it } from "vitest";
import { handleCommand } from "../../src/telegram/commands.js";
import { createLogTransport, sendAlert } from "../../src/telegram/send.js";
import { ChatStore } from "../../src/telegram/store.js";
import type { OutgoingAlert } from "../../src/telegram/types.js";

const flash: OutgoingAlert = {
  kind: "FLASH",
  asset: "BTC",
  horizon: "24h",
  pUp: 0.1,
  pDown: 0.7,
  pIn: 0.2,
  why: ["test"],
  kill: "none",
  id: "ev_1",
};

const digest: OutgoingAlert = { ...flash, kind: "DIGEST" };

describe("telegram policy", () => {
  it("does not send when TELEGRAM_DRY_RUN is true", async () => {
    const store = new ChatStore();
    store.bind("1");
    const result = await sendAlert(store, createLogTransport(), {
      chatId: "1",
      alert: flash,
      dryRun: true,
    });
    expect(result).toMatchObject({ sent: false, reason: "dry-run" });
    expect(result.html).toContain("FLASH BTC");
  });

  it("/mute 60 blocks FLASH but not DIGEST", async () => {
    const store = new ChatStore();
    const now = new Date("2026-09-07T12:00:00.000Z");
    handleCommand(store, "9", "/mute 60", now);
    const blocked = await sendAlert(store, createLogTransport(), {
      chatId: "9",
      alert: flash,
      dryRun: false,
      now,
    });
    const digestResult = await sendAlert(store, createLogTransport(), {
      chatId: "9",
      alert: digest,
      dryRun: false,
      now,
    });
    expect(blocked).toMatchObject({ sent: false, reason: "muted" });
    expect(digestResult.sent).toBe(true);
  });

  it("caps FLASH at 4 per day", async () => {
    const store = new ChatStore();
    const now = new Date("2026-09-07T12:00:00.000Z");
    store.bind("2");
    for (let i = 0; i < 4; i += 1) {
      const result = await sendAlert(store, createLogTransport(), {
        chatId: "2",
        alert: flash,
        dryRun: false,
        now,
      });
      expect(result.sent).toBe(true);
    }
    const fifth = await sendAlert(store, createLogTransport(), {
      chatId: "2",
      alert: flash,
      dryRun: false,
      now,
    });
    expect(fifth).toMatchObject({ sent: false, reason: "flash-cap" });
  });

  it("binds /start and /watch", () => {
    const store = new ChatStore();
    handleCommand(store, "7", "/start");
    const watch = handleCommand(store, "7", "/watch ETH");
    expect(store.get("7")?.watch).toEqual(["ETH"]);
    expect(watch.html).toContain("ETH");
  });
});
