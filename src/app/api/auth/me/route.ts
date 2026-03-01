import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/auth/me — returns the authenticated user's session profile.
 *
 * TODO: Read identity from session cookie / JWT.
 * For now, hardcoded to "frank" until real auth is wired up.
 */
export async function GET() {
  // TODO: extract userId from session/cookie/JWT
  const userId = "frank";

  try {
    const { rows } = await db.query(
      `SELECT user_id, full_name, email, is_active,
              locale, domains, supervisor_id, approval_limit
         FROM users
        WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const u = rows[0];

    if (!u.is_active) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    // TODO: query group memberships once groups/user_groups tables exist
    const isAdmin = true; // frank is admin for now

    return NextResponse.json({
      userId:        u.user_id,
      fullName:      u.full_name,
      email:         u.email,
      locale:        u.locale || "en-us",
      domains:       u.domains,
      supervisorId:  u.supervisor_id,
      approvalLimit: Number(u.approval_limit) || 0,
      groups:        [],
      isAdmin,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
