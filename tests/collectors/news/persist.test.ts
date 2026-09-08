import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ingestFeedXml, persistEventShells } from "../../../src/collectors/news/ingest.js";
import { sourceById } from "../../../src/collectors/news/sources.js";
import { createDb, createPool } from "../../../src/db/client.js";
import { migrate } from "../../../src/db/migrate.js";
import { alerts, events, outcomes } from "../../../src/db/schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
const xml = (name: string) => readFileSync(join(here, "../../fixtures/news", name), "utf8");

describe.skipIf(!databaseUrl)("news event shells", () => {
  const pool = createPool(databaseUrl ?? "");
  const db = createDb(pool);

  beforeAll(async () => {
    await migrate(databaseUrl ?? "");
  });

  beforeEach(async () => {
    await db.delete(outcomes);
    await db.delete(alerts);
    await db.delete(events);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("upserts OTHER shells until C2 classifies", async () => {
    const source = sourceById("coindesk");
    if (!source) {
      throw new Error("missing source");
    }
    const items = ingestFeedXml(source, xml("same-story-a.xml"));
    const rows = await persistEventShells(db, items);
    expect(rows[0]?.class).toBe("OTHER");
    expect(rows[0]?.source).toBe("coindesk");
  });
});
