import { NextResponse } from "next/server";
import pg from "pg";
import { buildOverview, serializeOverview } from "../../../../src/jobs/overview.js";
import { databaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = new pg.Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 5000 });
    try {
      const report = await buildOverview(pool, new Date());
      return NextResponse.json(serializeOverview(report));
    } finally {
      await pool.end();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
