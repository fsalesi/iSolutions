import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * PUT /api/notifications/read — mark notifications as read
 * Body: { id: number } or { all: true }
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  // TODO: get from real auth
  const currentUser = getCurrentUser(req);

  if (body.all === true) {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
      [currentUser]
    );
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [body.id, currentUser]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "id or all:true required" }, { status: 400 });
}
