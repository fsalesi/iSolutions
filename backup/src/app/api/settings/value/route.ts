import { NextRequest, NextResponse } from "next/server";
import { getSetting, getSystemSetting } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/settings/value?name=SETTING_NAME[&domain=X][&form=Y]
 *
 * Returns a single setting value using the cascade helper.
 * Checks user-level first (if authenticated), then system-level.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name parameter is required" }, { status: 400 });
  }

  const domain = req.nextUrl.searchParams.get("domain") || undefined;
  const form = req.nextUrl.searchParams.get("form") || undefined;
  const opts = { ...(domain ? { domain } : {}), ...(form ? { form } : {}) };

  try {
    const userId = getCurrentUser(req);
    const value = userId
      ? await getSetting(name, userId, opts)
      : await getSystemSetting(name, opts);

    return NextResponse.json({ name, value });
  } catch {
    return NextResponse.json({ error: "Failed to retrieve setting" }, { status: 500 });
  }
}
