import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { translateRequest } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, password } = await req.json();

    if (!userId?.trim()) {
      return NextResponse.json({ error: await translateRequest(req, "api.auth.user_id_required", "User ID is required") }, { status: 400 });
    }

    const { rows } = await db.query(
      `SELECT user_id, full_name, email, is_active, password_hash,
              locale, domains, supervisor_id, approval_limit, oid
         FROM users
        WHERE LOWER(user_id) = LOWER($1)`,
      [userId.trim()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: await translateRequest(req, "api.auth.invalid_credentials", "Invalid user ID or password") }, { status: 401 });
    }

    const u = rows[0];

    if (!u.is_active) {
      return NextResponse.json({ error: await translateRequest(req, "api.auth.account_disabled", "Account is disabled") }, { status: 403 });
    }

    const hash = u.password_hash ?? "";

    if (hash === "") {
      // No password set — reject unless they submitted a blank password too
      // (blank = account not yet configured for credential login)
      if (password?.length > 0) {
        return NextResponse.json({ error: await translateRequest(req, "api.auth.invalid_credentials", "Invalid user ID or password") }, { status: 401 });
      }
      // blank password + blank hash = allow (dev/SSO-only accounts)
    } else {
      if (!password?.length) {
        return NextResponse.json({ error: await translateRequest(req, "api.auth.password_required", "Password is required") }, { status: 400 });
      }
      const valid = await bcrypt.compare(password, hash);
      if (!valid) {
        return NextResponse.json({ error: await translateRequest(req, "api.auth.invalid_credentials", "Invalid user ID or password") }, { status: 401 });
      }
    }

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
      isAdmin:       true,
    });

    response.cookies.set(COOKIE_NAME, u.user_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
