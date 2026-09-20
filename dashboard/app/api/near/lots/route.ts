import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { addNearLot } from "../../../../../src/jobs/nearDesk.js";
import { deleteNearLot } from "../../../../../src/jobs/nearLots.js";
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

export async function POST(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
  try {
    const body = await request.json();
    const result = await withPool((pool) => addNearLot(pool, body));
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      lot: {
        id: result.id,
        side: result.side,
        at: result.at.toISOString(),
        tokens: result.tokens,
        value: result.value,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
  const id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const removed = await withPool((pool) => deleteNearLot(pool, id));
    if (!removed) {
      return NextResponse.json({ error: "lot not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
