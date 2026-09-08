import { Bot } from "grammy";
import type { Config } from "../config.js";
import { handleCommand } from "./commands.js";
import { ChatStore } from "./store.js";

export function createTelegramBot(config: Config, store = new ChatStore()): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN || "0:stub");
  const replyTo = async (ctx: { chat: { id: number }; message?: { text?: string }; reply: (text: string, extra?: { parse_mode: "HTML" }) => Promise<unknown> }) => {
    const text = ctx.message?.text;
    if (!text) {
      return;
    }
    const reply = handleCommand(store, String(ctx.chat.id), text);
    await ctx.reply(reply.html, { parse_mode: "HTML" });
  };
  bot.command("start", replyTo);
  bot.command("watch", replyTo);
  bot.command("mute", replyTo);
  bot.command("regime", replyTo);
  bot.command("why", replyTo);
  bot.command("last", replyTo);
  return bot;
}

export async function startTelegram(config: Config, store = new ChatStore()): Promise<Bot | undefined> {
  if (config.TELEGRAM_DRY_RUN || !config.TELEGRAM_BOT_TOKEN) {
    console.log("telegram: dry-run, not polling");
    return undefined;
  }
  const bot = createTelegramBot(config, store);
  await bot.start();
  return bot;
}
