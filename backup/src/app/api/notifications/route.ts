import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/notifications — list notifications for current user
 * Unread first, then read. Excludes soft-deleted.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));

  // TODO: get from real auth
  const currentUser = getCurrentUser(req);

  const res = await db.query(
    `SELECT nt.id, nt.note_id, nt.table_name, nt.record_oid, nt.is_read, nt.created_at,
            n.body AS note_body, n.author AS note_author,
            COALESCE(u.full_name, n.author) AS author_name
     FROM notifications nt
     JOIN notes n ON nt.note_id = n.id
     LEFT JOIN users u ON n.author = u.user_id
     WHERE nt.user_id = $1 AND nt.deleted_at IS NULL
     ORDER BY nt.is_read ASC, nt.created_at DESC
     LIMIT $2 OFFSET $3`,
    [currentUser, limit, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 AND deleted_at IS NULL`,
    [currentUser]
  );

  return NextResponse.json({ rows: res.rows, total: countRes.rows[0].total, offset, limit });
}

/**
 * DELETE /api/notifications?id=123 — soft-delete a notification
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // TODO: get from real auth
  const currentUser = getCurrentUser(req);

  await db.query(
    `UPDATE notifications SET deleted_at = NOW() WHERE id = $1 AND user_id = $2`,
    [id, currentUser]
  );

  return NextResponse.json({ ok: true });
}
