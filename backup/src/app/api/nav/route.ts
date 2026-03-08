import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Returns all forms for sidebar injection (never hide based on generation status). */
export async function GET() {
  const { rows } = await db.query(
    `SELECT form_key, form_name, menu_category, needs_generate
     FROM forms
     ORDER BY menu_category, form_name`
  );
  return NextResponse.json(rows);
}
