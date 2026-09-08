import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(here, "../../drizzle/0000_init.sql");

export async function migrate(databaseUrl: string): Promise<void> {
  const sql = await readFile(migrationPath, "utf8");
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

const entry = process.argv[1];
const isMain =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (isMain) {
  const { config } = await import("dotenv");
  config();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to migrate");
  }
  await migrate(url);
  console.log("migrated");
}
