import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { DEFAULT_DESK_SETTINGS } from "../../../../src/desk/defaults.js";
import { applyDeskPut, loadDeskSettings, loadNewsSources } from "../../../../src/desk/settings.js";
import { parseDeskPut } from "../../../../src/desk/validate.js";
import { dashSecret, databaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorize(request: NextRequest): NextResponse | null {
  const secret = dashSecret();
  if (secret && request.headers.get("x-dash-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

async function withPool<T>(fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 5000 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
  try {
    const payload = await withPool(async (pool) => ({
      settings: await loadDeskSettings(pool),
      sources: await loadNewsSources(pool),
    }));
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
  try {
    const parsed = parseDeskPut(await request.json(), DEFAULT_DESK_SETTINGS);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const payload = await withPool((pool) => applyDeskPut(pool, parsed));
    return NextResponse.json({ ok: true, ...payload });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
