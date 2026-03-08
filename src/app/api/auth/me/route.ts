import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { translateRequest } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);

  if (!userId) {
    return NextResponse.json({ error: await translateRequest(req, "api.auth.not_logged_in", "Not logged in") }, { status: 401 });
  }

  try {
    const { rows } = await db.query(
      `SELECT user_id, full_name, email, is_active, oid,
              locale, domains, supervisor_id, approval_limit
         FROM users
        WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: await translateRequest(req, "api.auth.user_not_found", "User not found") }, { status: 401 });
    }

    const u = rows[0];

    if (!u.is_active) {
      return NextResponse.json({ error: await translateRequest(req, "api.auth.account_disabled_short", "Account disabled") }, { status: 403 });
    }

    return NextResponse.json({
      oid:           u.oid,
      userId:        u.user_id,
      fullName:      u.full_name,
      email:         u.email,
      locale:        u.locale || "en-us",
      domains:       u.domains || "",
      supervisorId:  u.supervisor_id || "",
      approvalLimit: Number(u.approval_limit) || 0,
      groups:        [],
      isAdmin:       true, // TODO: derive from group membership
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
