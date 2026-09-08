import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const QUEUE_NAMES = [
  "tape",
  "news",
  "features",
  "classify",
  "outcomes",
  "digest",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

export type QueueMap = { [K in QueueName]: Queue };

export function createQueueConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
  });
}

export function createQueues(connection: Redis): QueueMap {
  const queues = {} as QueueMap;
  for (const name of QUEUE_NAMES) {
    queues[name] = new Queue(name, { connection });
  }
  return queues;
}

export async function closeQueues(queues: QueueMap, connection: Redis): Promise<void> {
  await Promise.all(QUEUE_NAMES.map((name) => queues[name].close()));
  connection.disconnect();
}
