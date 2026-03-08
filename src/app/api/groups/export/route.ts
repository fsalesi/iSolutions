import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const rows = await db.query<{
      group_id:    string;
      description: string;
      user_id:     string;
      full_name:   string;
      title:       string;
    }>(
      `SELECT
         g.group_id,
         g.description,
         u.user_id,
         u.full_name,
         u.title
       FROM   groups       g
       JOIN   group_members gm ON gm.group_id = g.group_id
       JOIN   users         u  ON u.user_id   = gm.member_id
       ORDER  BY g.group_id, u.user_id`
    );

    return NextResponse.json({ rows: rows.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
