import { Redis } from "ioredis";
import { redisUrl } from "./env";
import { OPS_HEARTBEAT_KEY, OPS_LOG_LIST, type OpsEvent, type OpsHeartbeat } from "./types";

let client: Redis | undefined;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(redisUrl(), { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return client;
}

export async function readLogs(after = 0): Promise<OpsEvent[]> {
  const raw = await getRedis().lrange(OPS_LOG_LIST, 0, 399);
  const events = raw
    .map((row) => {
      try {
        return JSON.parse(row) as OpsEvent;
      } catch {
        return null;
      }
    })
    .filter((row): row is OpsEvent => Boolean(row))
    .reverse()
    .filter((row) => row.seq > after);
  return events;
}

export async function readHeartbeat(): Promise<OpsHeartbeat | null> {
  const raw = await getRedis().get(OPS_HEARTBEAT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as OpsHeartbeat;
  } catch {
    return null;
  }
}

export function workerOnline(heartbeat: OpsHeartbeat | null, now = Date.now()): boolean {
  if (!heartbeat) {
    return false;
  }
  return now - new Date(heartbeat.ts).getTime() < 20_000;
}
