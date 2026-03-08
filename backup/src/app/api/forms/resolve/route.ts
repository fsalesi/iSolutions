import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/forms/resolve?table=requisition → { form_key: "POReq" } */
export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table")?.trim();
  if (!table) return NextResponse.json({ form_key: null });
  const res = await db.query(
    `SELECT form_key FROM form_tables ft
     WHERE ft.table_name = $1 AND ft.is_header = true 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ft.table_name)
     LIMIT 1`,
    [table]
  );
  return NextResponse.json({ form_key: res.rows[0]?.form_key ?? null });
}
