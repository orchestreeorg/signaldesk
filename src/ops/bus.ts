import type { Redis } from "ioredis";
import { createRedisOpsSink, setOpsSink } from "./log.js";
import { formatWait, nextDigestAt, nextNewsAt, nextTapeAt } from "./clock.js";
import {
  OPS_CONTROL_CHANNEL,
  OPS_HEARTBEAT_KEY,
  OPS_HEARTBEAT_TTL_SEC,
  type OpsControl,
  type OpsHeartbeat,
} from "./types.js";

export type OpsBus = {
  heartbeat: (partial: Omit<OpsHeartbeat, "ts" | "waiting" | "nextNewsAt" | "nextTapeAt" | "nextDigestAt">) => Promise<void>;
  subscribeControl: (onCommand: (command: OpsControl) => void) => void;
  close: () => void;
};

export function startOpsBus(redis: Redis): OpsBus {
  setOpsSink(createRedisOpsSink(redis));
  const control = redis.duplicate();
  void control.subscribe(OPS_CONTROL_CHANNEL);

  return {
    async heartbeat(partial) {
      const now = new Date();
      const nextNews = nextNewsAt(now);
      const nextTape = nextTapeAt(now);
      const nextDigest = nextDigestAt(now);
      const body: OpsHeartbeat = {
        ...partial,
        ts: now.toISOString(),
        nextNewsAt: nextNews.toISOString(),
        nextTapeAt: nextTape.toISOString(),
        nextDigestAt: nextDigest.toISOString(),
        waiting: {
          news: formatWait(nextNews, now),
          tape: formatWait(nextTape, now),
          digest: formatWait(nextDigest, now),
        },
      };
      await redis.set(OPS_HEARTBEAT_KEY, JSON.stringify(body), "EX", OPS_HEARTBEAT_TTL_SEC);
    },
    subscribeControl(onCommand) {
      control.on("message", (_channel, raw) => {
        try {
          onCommand(JSON.parse(raw) as OpsControl);
        } catch {
          // ignore malformed control
        }
      });
    },
    close() {
      setOpsSink(undefined);
      control.disconnect();
    },
  };
}
