import type pg from "pg";
import { sendMacroIndex, type TelegramTransport } from "../telegram/send.js";
import { buildOverview } from "./overview.js";
import type { OverviewMacroIndex } from "./macroScale.js";

export type MacroIndexEmitResult = {
  sent: boolean;
  reason?: "dry-run";
  html: string;
  index: OverviewMacroIndex | null;
};

/**
 * Same weekly 1–10 composite Overview shows. Telegram-only send path.
 * Context only; not FLASH.
 */
export async function emitMacroIndex(
  pool: pg.Pool,
  transport: TelegramTransport,
  input: { chatId: string; dryRun: boolean; now?: Date },
): Promise<MacroIndexEmitResult> {
  const now = input.now ?? new Date();
  const report = await buildOverview(pool, now);
  const result = await sendMacroIndex(transport, {
    chatId: input.chatId,
    index: report.macroIndex,
    dryRun: input.dryRun,
    now,
  });
  return {
    sent: result.sent,
    reason: result.sent ? undefined : result.reason,
    html: result.html,
    index: report.macroIndex,
  };
}
