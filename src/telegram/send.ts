import { Bot } from "grammy";
import type { AlertKind } from "../domain/index.js";
import { renderAlert } from "./html.js";
import { ChatStore } from "./store.js";
import type { OutgoingAlert } from "./types.js";

export type TelegramTransport = {
  send(chatId: string, html: string): Promise<void>;
};

export type SendResult =
  | { sent: true; html: string }
  | { sent: false; html: string; reason: "muted" | "flash-cap" | "dry-run" };

export function createLogTransport(): TelegramTransport {
  return {
    async send(chatId, html) {
      console.log(`telegram dry-run chat=${chatId}\n${html}`);
    },
  };
}

export function createApiTransport(token: string): TelegramTransport {
  const bot = new Bot(token);
  return {
    async send(chatId, html) {
      await bot.api.sendMessage(chatId, html, { parse_mode: "HTML" });
    },
  };
}

export async function sendAlert(
  store: ChatStore,
  transport: TelegramTransport,
  input: {
    chatId: string;
    alert: OutgoingAlert;
    dryRun: boolean;
    now?: Date;
  },
): Promise<SendResult> {
  const html = renderAlert(input.alert);
  const now = input.now ?? new Date();
  const allowed = store.canSend(input.chatId, input.alert.kind, now);
  if (!allowed.ok) {
    return { sent: false, html, reason: allowed.reason };
  }
  if (input.dryRun) {
    await transport.send(input.chatId, html);
    if (input.alert.kind === "FLASH") {
      store.recordFlash(input.chatId, now);
    }
    return { sent: false, html, reason: "dry-run" };
  }
  await transport.send(input.chatId, html);
  if (input.alert.kind === "FLASH") {
    store.recordFlash(input.chatId, now);
  }
  return { sent: true, html };
}

export function isSendableKind(kind: AlertKind): boolean {
  return ["FLASH", "FADE", "CONFIRM", "INVALIDATE", "DIGEST"].includes(kind);
}
