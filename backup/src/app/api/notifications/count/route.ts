import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/notifications/count — unread count for current user
 * Polled every 5 seconds by the NotificationBell component.
 */
export async function GET(req: NextRequest) {
  // TODO: get from real auth
  const currentUser = getCurrentUser(req);

  const res = await db.query(
    `SELECT COUNT(*)::int AS unread
     FROM notifications
     WHERE user_id = $1 AND is_read = FALSE AND deleted_at IS NULL`,
    [currentUser]
  );

  return NextResponse.json({ unread: res.rows[0].unread });
}
