import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { Redis } from "ioredis";
import { loadConfig } from "../config.js";

export async function runOnce(): Promise<void> {
  const config = loadConfig();
  const client = new pg.Client({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: 5000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Redis PING failed: ${pong}`);
    }
    // TELEGRAM_DRY_RUN is true by default; this ticket has no bot.
    console.log("dry-run: 0 events");
  } finally {
    await client.end().catch(() => undefined);
    redis.disconnect();
  }
}

const entry = process.argv[1];
const isMain =
  entry !== undefined &&
  import.meta.url === pathToFileURL(resolve(entry)).href;
if (isMain) {
  runOnce().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
