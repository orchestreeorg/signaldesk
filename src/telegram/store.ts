import type { AlertKind, Asset } from "../domain/index.js";
import { FLASH_DAILY_CAP } from "./types.js";

export type ChatState = {
  chatId: string;
  watch: Asset[];
  mutedUntil: Date | null;
  flashAt: Date[];
};

export type SendDecision =
  | { ok: true }
  | { ok: false; reason: "muted" | "flash-cap" };

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export class ChatStore {
  private readonly chats = new Map<string, ChatState>();

  bind(chatId: string): ChatState {
    const existing = this.chats.get(chatId);
    if (existing) {
      return existing;
    }
    const created: ChatState = {
      chatId,
      watch: ["BTC", "ETH"],
      mutedUntil: null,
      flashAt: [],
    };
    this.chats.set(chatId, created);
    return created;
  }

  get(chatId: string): ChatState | undefined {
    return this.chats.get(chatId);
  }

  setWatch(chatId: string, assets: Asset[]): ChatState {
    const chat = this.bind(chatId);
    chat.watch = assets.length > 0 ? assets : ["BTC", "ETH"];
    return chat;
  }

  mute(chatId: string, minutes: number, now = new Date()): ChatState {
    const chat = this.bind(chatId);
    chat.mutedUntil = new Date(now.getTime() + minutes * 60_000);
    return chat;
  }

  isMuted(chatId: string, now = new Date()): boolean {
    const chat = this.chats.get(chatId);
    return Boolean(chat?.mutedUntil && chat.mutedUntil.getTime() > now.getTime());
  }

  recordFlash(chatId: string, now = new Date()): void {
    const chat = this.bind(chatId);
    chat.flashAt.push(now);
  }

  flashCountToday(chatId: string, now = new Date()): number {
    const chat = this.chats.get(chatId);
    if (!chat) {
      return 0;
    }
    const day = utcDay(now);
    return chat.flashAt.filter((at) => utcDay(at) === day).length;
  }

  canSend(chatId: string, kind: AlertKind, now = new Date()): SendDecision {
    if (kind === "DIGEST") {
      return { ok: true };
    }
    if (kind === "FLASH" && this.isMuted(chatId, now)) {
      return { ok: false, reason: "muted" };
    }
    if (kind === "FLASH" && this.flashCountToday(chatId, now) >= FLASH_DAILY_CAP) {
      return { ok: false, reason: "flash-cap" };
    }
    return { ok: true };
  }
}
