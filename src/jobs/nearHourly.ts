import type pg from "pg";
import { sendNearPosition, type TelegramTransport } from "../telegram/send.js";
import { listNearLots, summarizeNearLots, type NearLot, type NearPosition } from "./nearLots.js";
import { loadNearPrice, type NearQuote } from "./nearPrice.js";

export type NearPositionEmitResult = {
  sent: boolean;
  reason?: "dry-run";
  html: string;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
};

/**
 * Hourly NEAR mark on the dedicated bot: live price, Position lots, holdings USD.
 * Telegram-only send path. Context only; not FLASH; not fusion; not NEAR news.
 */
export async function emitNearPosition(
  pool: pg.Pool,
  transport: TelegramTransport,
  input: { chatId: string; dryRun: boolean; now?: Date },
): Promise<NearPositionEmitResult> {
  const now = input.now ?? new Date();
  const lots = await listNearLots(pool);
  const quote = await loadNearPrice({ now });
  const position = summarizeNearLots(lots);
  const result = await sendNearPosition(transport, {
    chatId: input.chatId,
    quote,
    position,
    lots,
    dryRun: input.dryRun,
    now,
  });
  return {
    sent: result.sent,
    reason: result.sent ? undefined : result.reason,
    html: result.html,
    quote,
    position,
    lots,
  };
}
