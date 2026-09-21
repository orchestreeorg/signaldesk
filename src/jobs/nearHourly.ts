import type pg from "pg";
import { sendNearPosition, type TelegramTransport } from "../telegram/send.js";
import { loadNearNews, type NearHeadline } from "./nearNews.js";
import { loadNearNote, type NearNoteStatus } from "./nearNote.js";
import { listNearLots, summarizeNearLots, type NearLot, type NearPosition } from "./nearLots.js";
import { loadNearPrice, type NearQuote } from "./nearPrice.js";

export type NearPositionEmitResult = {
  sent: boolean;
  reason?: "dry-run";
  html: string;
  quote: NearQuote | null;
  position: NearPosition;
  lots: NearLot[];
  noteStatus: NearNoteStatus;
};

/**
 * Hourly NEAR mark on the dedicated bot: live price, Position lots, holdings USD.
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
    noteStatus: note.status,
  };
}
