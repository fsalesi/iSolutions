import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId?.trim()) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const { rows } = await db.query(
      `SELECT user_id, full_name, email, is_active,
              locale, domains, supervisor_id, approval_limit, oid
         FROM users
        WHERE LOWER(user_id) = LOWER($1)`,
      [userId.trim()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const u = rows[0];

    if (!u.is_active) {
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    // TODO: validate password when auth is wired up

    // Set a simple session cookie (userId only for now)
    const response = NextResponse.json({
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

    response.cookies.set(COOKIE_NAME, u.user_id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
