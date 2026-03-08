import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { translateRequest } from "@/lib/i18n/server";

/** PUT /api/users/locale — updates the current user's locale preference */
export async function PUT(req: NextRequest) {
  try {
    const { userId, locale } = await req.json();
    if (!userId || !locale) {
      return NextResponse.json({ error: await translateRequest(req, "api.users.locale_required", "userId and locale required") }, { status: 400 });
    }

    // Validate locale exists
    const check = await db.query("SELECT code FROM locales WHERE code = $1", [locale]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: await translateRequest(req, "api.users.unknown_locale", "Unknown locale: {locale}", { locale }) }, { status: 400 });
    }

    await db.query(
      "UPDATE users SET locale = $1, updated_at = now() WHERE user_id = $2",
      [locale, userId]
    );

    return NextResponse.json({ ok: true, locale });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
