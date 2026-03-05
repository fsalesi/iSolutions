import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Returns generated forms for sidebar injection. */
export async function GET() {
  const { rows } = await db.query(
    `SELECT form_key, form_name, menu_category
     FROM forms
     WHERE needs_generate = false
     ORDER BY menu_category, form_name`
  );
  return NextResponse.json(rows);
}
