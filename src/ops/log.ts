import type { Redis } from "ioredis";
import {
  OPS_LOG_LIMIT,
  OPS_LOG_LIST,
  OPS_SEQ_KEY,
  type OpsEvent,
  type OpsLevel,
} from "./types.js";

export type OpsSink = (event: OpsEvent) => void | Promise<void>;

let seq = 0;
let sink: OpsSink | undefined;

export function formatOpsLine(event: OpsEvent): string {
  return `${event.ts} [${event.level}] ${event.scope} ${event.code}: ${event.message}`;
}

export function setOpsSink(next?: OpsSink): void {
  sink = next;
}

export function ops(
  scope: string,
  code: string,
  message: string,
  opts?: { level?: OpsLevel; data?: Record<string, unknown> },
): OpsEvent {
  seq += 1;
  const event: OpsEvent = {
    seq,
    ts: new Date().toISOString(),
    level: opts?.level ?? "info",
    scope,
    code,
    message,
    data: opts?.data,
  };
  if (!process.env.VITEST || sink) {
    console.log(formatOpsLine(event));
  }
  void sink?.(event);
  return event;
}

export function createRedisOpsSink(redis: Redis): OpsSink {
  return async (event) => {
    const id = await redis.incr(OPS_SEQ_KEY);
    const stored = { ...event, seq: id };
    const payload = JSON.stringify(stored);
    await redis.lpush(OPS_LOG_LIST, payload);
    await redis.ltrim(OPS_LOG_LIST, 0, OPS_LOG_LIMIT - 1);
    await redis.publish(OPS_LOG_LIST, payload);
  };
}
