import { NextRequest, NextResponse } from "next/server";
import { getSystemSetting } from "@/lib/settings";

/**
 * GET /api/settings/list?name=SETTING_NAME[&valueField=code][&search=x][&limit=200]
 *
 * Reads a comma-separated system setting and returns it in standard lookup shape:
 *   { rows: [{ code: "demo1" }, ...], total: N }
 *
 * Used by DomainLookup and any other lookup backed by a comma-separated setting.
 * No domain filter — system settings use domain='*' (global).
 */
export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name parameter is required" }, { status: 400 });
    }

    const valueField  = req.nextUrl.searchParams.get("valueField") || "code";
    const search      = req.nextUrl.searchParams.get("search")?.toLowerCase() || "";
    const limit       = Math.min(500, parseInt(req.nextUrl.searchParams.get("limit") || "200"));

    const raw = await getSystemSetting(name);
    if (!raw) return NextResponse.json({ rows: [], total: 0 });

    let rows = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((value) => ({ [valueField]: value }));

    if (search) {
      rows = rows.filter((r) => r[valueField].toLowerCase().includes(search));
    }

    const total = rows.length;
    rows = rows.slice(0, limit);

    return NextResponse.json({ rows, total });
  } catch (err: any) {
    console.error("GET /api/settings/list error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
