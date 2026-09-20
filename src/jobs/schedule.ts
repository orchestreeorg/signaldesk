import { DESK_TZ } from "../ops/tz.js";
import type { QueueMap } from "../queue.js";
import type { OutgoingAlert } from "../telegram/types.js";

export const DIGEST_HOURS = [0, 8, 16] as const;
export const DIGEST_CRON = "0 0,8,16 * * *";
export const DIGEST_SCHEDULER_ID = "digest-utc";
export const NEWS_CRON = "*/5 * * * *";
export const NEWS_SCHEDULER_ID = "news-poll";
export const TAPE_CRON = "* * * * *";
export const TAPE_SCHEDULER_ID = "tape-oi";
export const MACRO_CRON = "0 * * * *";
export const MACRO_SCHEDULER_ID = "macro-hourly";
export const NEAR_CRON = "0 * * * *";
export const NEAR_SCHEDULER_ID = "near-hourly";

export function isMacroJob(job: { name?: string; data?: { kind?: string } }): boolean {
  const kind = job.data?.kind;
  return job.name === "macro" || job.name === "macro-now" || kind === "MACRO" || kind === "macro";
}

export function isNearJob(job: { name?: string; data?: { kind?: string } }): boolean {
  const kind = job.data?.kind;
  return job.name === "near" || job.name === "near-now" || kind === "NEAR";
}

export function dummyAlert(kind: "FLASH" | "DIGEST"): OutgoingAlert {
  return {
    kind,
    asset: "BTC",
    horizon: "24h",
    pUp: 0.34,
    pDown: 0.33,
    pIn: 0.33,
    why: kind === "FLASH" ? ["smoke FLASH"] : ["scheduled digest 00/08/16 ART"],
    kill: "none",
    eventId: `smoke-${kind.toLowerCase()}`,
    id: `smoke-${kind.toLowerCase()}`,
  };
}

export async function registerSchedules(queues: QueueMap): Promise<string[]> {
  await queues.digest.upsertJobScheduler(
    DIGEST_SCHEDULER_ID,
    { pattern: DIGEST_CRON, tz: DESK_TZ },
    { name: "digest", data: { kind: "DIGEST" } },
  );
  await queues.digest.upsertJobScheduler(
    MACRO_SCHEDULER_ID,
    { pattern: MACRO_CRON, tz: DESK_TZ },
    { name: "macro", data: { kind: "MACRO" } },
  );
  await queues.digest.upsertJobScheduler(
    NEAR_SCHEDULER_ID,
    { pattern: NEAR_CRON, tz: DESK_TZ },
    { name: "near", data: { kind: "NEAR" } },
  );
  await queues.news.upsertJobScheduler(
    NEWS_SCHEDULER_ID,
    { pattern: NEWS_CRON, tz: DESK_TZ },
    { name: "news", data: { kind: "news" } },
  );
  await queues.tape.upsertJobScheduler(
    TAPE_SCHEDULER_ID,
    { pattern: TAPE_CRON, tz: DESK_TZ },
    { name: "tape", data: { kind: "tape" } },
  );
  return [DIGEST_SCHEDULER_ID, MACRO_SCHEDULER_ID, NEAR_SCHEDULER_ID, NEWS_SCHEDULER_ID, TAPE_SCHEDULER_ID];
}
