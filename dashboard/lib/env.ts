import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../.env") });

export function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is required for the ops dashboard");
  }
  return url;
}

export function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

export function dashSecret(): string {
  return process.env.DASH_SECRET ?? "";
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for Parameters");
  }
  return url;
}
