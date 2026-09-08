import type { QueueMap } from "../queue.js";
import type { OutgoingAlert } from "../telegram/types.js";

export const DIGEST_HOURS_UTC = [0, 8, 16] as const;
export const DIGEST_CRON = "0 0,8,16 * * *";
export const DIGEST_SCHEDULER_ID = "digest-utc";
export const NEWS_CRON = "*/5 * * * *";
export const NEWS_SCHEDULER_ID = "news-poll";
export const TAPE_CRON = "* * * * *";
export const TAPE_SCHEDULER_ID = "tape-oi";

export function dummyAlert(kind: "FLASH" | "DIGEST"): OutgoingAlert {
  return {
    kind,
    asset: "BTC",
    horizon: "24h",
    pUp: 0.34,
    pDown: 0.33,
    pIn: 0.33,
    why: kind === "FLASH" ? ["smoke FLASH"] : ["scheduled digest 00/08/16 UTC"],
    kill: "none",
    eventId: `smoke-${kind.toLowerCase()}`,
    id: `smoke-${kind.toLowerCase()}`,
  };
}

export async function registerSchedules(queues: QueueMap): Promise<string[]> {
  await queues.digest.upsertJobScheduler(
    DIGEST_SCHEDULER_ID,
    { pattern: DIGEST_CRON, tz: "UTC" },
    { name: "digest", data: { kind: "DIGEST" } },
  );
  await queues.news.upsertJobScheduler(
    NEWS_SCHEDULER_ID,
    { pattern: NEWS_CRON, tz: "UTC" },
    { name: "news", data: { kind: "news" } },
  );
  await queues.tape.upsertJobScheduler(
    TAPE_SCHEDULER_ID,
    { pattern: TAPE_CRON, tz: "UTC" },
    { name: "tape", data: { kind: "tape" } },
  );
  return [DIGEST_SCHEDULER_ID, NEWS_SCHEDULER_ID, TAPE_SCHEDULER_ID];
}
