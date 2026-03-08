import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get("locale") || "en-us";

  const { rows } = await db.query(
    `SELECT namespace, key, value FROM translations WHERE locale = $1`,
    [locale]
  );

  // Build flat map: "namespace.key" -> "value"
  const bundle: Record<string, string> = {};
  for (const row of rows) {
    bundle[`${row.namespace}.${row.key}`] = row.value;
  }

  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
