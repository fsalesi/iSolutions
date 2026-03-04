import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const { locale, namespace, key, value } = await req.json();

  if (!locale || !namespace || !key) {
    return NextResponse.json({ error: "locale, namespace, and key are required" }, { status: 400 });
  }

  // Upsert: insert or update
  await db.query(
    `INSERT INTO translations (locale, namespace, key, value, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (locale, namespace, key) DO UPDATE SET value = $4, updated_by = $5`,
    [locale, namespace, key, value, "admin"] // TODO: real user from auth
  );

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const namespace = req.nextUrl.searchParams.get("namespace");
  const key = req.nextUrl.searchParams.get("key");
  if (!namespace || !key) {
    return NextResponse.json({ error: "namespace and key are required" }, { status: 400 });
  }
  const { rows } = await db.query(
    `SELECT locale, value FROM translations WHERE namespace = $1 AND key = $2`,
    [namespace, key]
  );
  const result: Record<string, string> = {};
  for (const row of rows) result[row.locale] = row.value;
  return NextResponse.json(result);
}
