import type pg from "pg";
import { sendNearPosition, type TelegramTransport } from "../telegram/send.js";
import { recordNearAth, type NearAthView } from "./nearAth.js";
import { loadNearNews, type NearHeadline } from "./nearNews.js";
import { loadNearNote, type NearNoteStatus } from "./nearNote.js";
import { listNearLots, summarizeNearLots, type NearLot, type NearPosition } from "./nearLots.js";
import { loadNearPrice, type NearQuote } from "./nearPrice.js";
import { simulateNearHoldingsUsd } from "./nearSimulate.js";

export type NearPositionEmitResult = {
  sent: boolean;
  reason?: "dry-run";
  html: string;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  ath: NearAthView | null;
  noteStatus: NearNoteStatus;
};

/**
 * Hourly NEAR mark on the dedicated bot: live price, holdings USD, ATH vs mark.
 * Optional LLM clerk note. Telegram-only send path. Not FLASH; not fusion.
 */
export async function emitNearPosition(
  pool: pg.Pool,
  transport: TelegramTransport,
  input: {
    chatId: string;
    dryRun: boolean;
    now?: Date;
    llm?: {
      apiKey: string;
      baseUrl?: string;
      model?: string;
      complete?: typeof import("../classify/complete.js").completeChat;
    };
    headlines?: NearHeadline[];
  },
): Promise<NearPositionEmitResult> {
  const now = input.now ?? new Date();
  const lots = await listNearLots(pool);
  const [quote, headlines] = await Promise.all([
    loadNearPrice({ now }),
    input.headlines ? Promise.resolve(input.headlines) : loadNearNews({ now }).catch(() => []),
  ]);
  const position = summarizeNearLots(lots);
  const mark = quote ? simulateNearHoldingsUsd(position.tokens, quote.value) : null;
  const ath = mark == null ? null : await recordNearAth(pool, mark, now);
  const note = await loadNearNote({
    now,
    quote,
    position,
    lots,
    headlines,
    apiKey: input.llm?.apiKey ?? "",
    baseUrl: input.llm?.baseUrl,
    model: input.llm?.model,
    complete: input.llm?.complete,
  });
  const result = await sendNearPosition(transport, {
    chatId: input.chatId,
    quote,
    position,
    lots,
    ath,
    note: note.note,
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
    ath,
    noteStatus: note.status,
  };
}
