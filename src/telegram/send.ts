import { Bot } from "grammy";
import type { AlertKind } from "../domain/index.js";
import { renderAlert, renderDigest, renderHeadline } from "./html.js";
import type { DigestReport } from "../jobs/digest.js";
import { ChatStore } from "./store.js";
import { DEFAULT_DESK_SETTINGS } from "../desk/defaults.js";
import type { DeskSettings } from "../desk/types.js";
import { headlineTone, shouldSendHeadline, type HeadlineTone } from "./tone.js";
import type { OutgoingAlert } from "./types.js";

export type TelegramTransport = {
  send(chatId: string, html: string): Promise<void>;
};

export type SendResult =
  | { sent: true; html: string }
  | { sent: false; html: string; reason: "muted" | "flash-cap" | "dry-run" };

export type HeadlineSendResult =
  | { sent: true; html: string }
  | { sent: false; html: string; reason: "dry-run" | "filtered" };

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

export async function sendDigest(
  store: ChatStore,
  transport: TelegramTransport,
  input: {
    chatId: string;
    html?: string;
    report?: DigestReport;
    dryRun: boolean;
    now?: Date;
  },
): Promise<SendResult> {
  const html = input.html ?? (input.report ? renderDigest(input.report) : "");
  const now = input.now ?? new Date();
  const allowed = store.canSend(input.chatId, "DIGEST", now);
  if (!allowed.ok) {
    return { sent: false, html, reason: allowed.reason };
  }
  await transport.send(input.chatId, html);
  if (input.dryRun) {
    return { sent: false, html, reason: "dry-run" };
  }
  return { sent: true, html };
}

export function isSendableKind(kind: AlertKind): boolean {
  return ["FLASH", "FADE", "CONFIRM", "INVALIDATE", "DIGEST"].includes(kind);
}

/**
 * First-seen headline ping. Not an AlertKind.
 * Mute does not block headlines (mute still blocks FLASH via sendAlert).
 * The 4 FLASH/day cap does not apply.
 */
export async function sendHeadline(
  transport: TelegramTransport,
  input: {
    chatId: string;
    sourceName: string;
    title: string;
    url: string;
    dryRun: boolean;
    sourceId?: string;
    tone?: HeadlineTone;
    settings?: DeskSettings;
  },
): Promise<HeadlineSendResult> {
  const settings = input.settings ?? DEFAULT_DESK_SETTINGS;
  const tone = input.tone ?? headlineTone(input.title, settings);
  const html = renderHeadline({
    sourceName: input.sourceName,
    title: input.title,
    url: input.url,
    tone,
  });
  if (!shouldSendHeadline(tone, settings)) {
    return { sent: false, html, reason: "filtered" };
  }
  await transport.send(input.chatId, html);
  if (input.dryRun) {
    return { sent: false, html, reason: "dry-run" };
  }
  return { sent: true, html };
}

export async function sendHeadlines(
  transport: TelegramTransport,
  input: {
    chatId: string;
    items: Array<{ sourceId: string; title: string; url: string }>;
    dryRun: boolean;
    sourceNameOf?: (sourceId: string) => string;
    settings?: DeskSettings;
  },
): Promise<HeadlineSendResult[]> {
  const nameOf = input.sourceNameOf ?? ((sourceId: string) => sourceId);
  const settings = input.settings ?? DEFAULT_DESK_SETTINGS;
  const results: HeadlineSendResult[] = [];
  for (const item of input.items) {
    results.push(
      await sendHeadline(transport, {
        chatId: input.chatId,
        sourceName: nameOf(item.sourceId),
        sourceId: item.sourceId,
        title: item.title,
        url: item.url,
        dryRun: input.dryRun,
        settings,
      }),
    );
  }
  return results;
}
