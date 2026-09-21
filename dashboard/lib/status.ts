import {
  fresherHeartbeat,
  readOpsHeartbeat,
  workerOnline,
} from "../../src/ops/heartbeat.js";
import type { OpsHeartbeat } from "./types";
import { isVercel } from "./env";
import { getDatabase } from "./pg";
import { readHeartbeat } from "./redis";
import { canSpawnWorker } from "./spawn";

export type WorkerStatus = {
  online: boolean;
  heartbeat: OpsHeartbeat | null;
  spawnable: boolean;
  vercel: boolean;
  error?: string;
};

export async function loadWorkerStatus(): Promise<WorkerStatus> {
  let pgHeartbeat: OpsHeartbeat | null = null;
  let redisHeartbeat: OpsHeartbeat | null = null;
  let error: string | undefined;

  try {
    pgHeartbeat = await readOpsHeartbeat(getDatabase());
  } catch (caught: unknown) {
    error = caught instanceof Error ? caught.message : String(caught);
  }

  try {
    redisHeartbeat = await readHeartbeat();
  } catch (caught: unknown) {
    if (!pgHeartbeat) {
      error = error ?? (caught instanceof Error ? caught.message : String(caught));
    }
  }

  const heartbeat = fresherHeartbeat(pgHeartbeat, redisHeartbeat);
  return {
    online: workerOnline(heartbeat),
    heartbeat,
    spawnable: canSpawnWorker(),
    vercel: isVercel(),
    ...(error && !heartbeat ? { error } : {}),
  };
}
