import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { buildOverview, serializeOverview } from "../../../../src/jobs/overview.js";
import { dashSecret, databaseUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorize(request: NextRequest): NextResponse | null {
  const secret = dashSecret();
  if (secret && request.headers.get("x-dash-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) {
    return denied;
  }
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
