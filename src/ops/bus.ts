import type { Redis } from "ioredis";
import { composeHeartbeat, type HeartbeatPartial } from "./heartbeat.js";
import { createRedisOpsSink, setOpsSink } from "./log.js";
import {
  OPS_CONTROL_CHANNEL,
  OPS_HEARTBEAT_KEY,
  OPS_HEARTBEAT_TTL_SEC,
  type OpsControl,
  type OpsHeartbeat,
} from "./types.js";

export type OpsBus = {
  heartbeat: (partial: HeartbeatPartial) => Promise<OpsHeartbeat>;
  subscribeControl: (onCommand: (command: OpsControl) => void) => void;
  close: () => void;
};

export function startOpsBus(redis: Redis): OpsBus {
  setOpsSink(createRedisOpsSink(redis));
  const control = redis.duplicate();
  void control.subscribe(OPS_CONTROL_CHANNEL);

  return {
    async heartbeat(partial) {
      const body = composeHeartbeat(partial);
      await redis.set(OPS_HEARTBEAT_KEY, JSON.stringify(body), "EX", OPS_HEARTBEAT_TTL_SEC);
      return body;
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
