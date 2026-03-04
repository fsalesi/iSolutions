import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/columns?table=users
 * Returns column metadata from the schema: name and data type.
 * Excludes audit/system columns.
 */
const HIDDEN = new Set(["oid", "password_hash", "photo", "photo_type"]);

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table");
  if (!table || !/^[a-z_]+$/.test(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const res = await db.query(`
    SELECT column_name, data_type, numeric_scale, is_nullable
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [table]);

  const columns = res.rows
    .filter(r => !HIDDEN.has(r.column_name))
    .map(r => {
      const dt = r.data_type.toLowerCase();
      let type = "text";
      let scale: number | undefined;
      if (dt.includes("int")) { type = "number"; scale = 0; }
      else if (dt.includes("numeric") || dt.includes("float") || dt.includes("double") || dt === "real") {
        type = "number";
        scale = r.numeric_scale ?? 2;
      }
      else if (dt === "boolean") type = "boolean";
      else if (dt.includes("timestamp")) type = "datetime";
      else if (dt === "date") type = "date";
      const col: any = { key: r.column_name, type, nullable: r.is_nullable === 'YES' };
      if (scale !== undefined) col.scale = scale;
      return col;
    });

  return NextResponse.json(columns);
}
