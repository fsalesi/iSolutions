import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/grid-prefs?grid=POReq:requisition&user=frank
 *
 * Returns column + settings prefs for this grid.
 * Priority: user pref > admin default > null (use client default).
 *
 * allowedKeys  — admin-curated list of columns users may ever see/export. NULL = unrestricted.
 * defaultKeys  — admin default visible columns (was visible_keys).
 * settings     — { show_search, show_footer, show_excel } admin flags.
 */
export async function GET(req: NextRequest) {
  try {
    const gridId = req.nextUrl.searchParams.get("grid");
    const userId = req.nextUrl.searchParams.get("user");
    if (!gridId) return NextResponse.json({ error: "grid param required" }, { status: 400 });

    const adminRes = await db.query(
      `SELECT default_keys, allowed_keys, export_keys, settings FROM grid_defaults WHERE grid_id = $1`,
      [gridId]
    );
    const admin = adminRes.rows[0] || {};

    let userPref: any = {};
    if (userId) {
      const userRes = await db.query(
        `SELECT visible_keys, export_keys FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`,
        [gridId, userId]
      );
      userPref = userRes.rows[0] || {};
    }

    // Clamp user prefs against allowedKeys if admin has set a restriction
    const allowedKeys: string[] | null = admin.allowed_keys || null;

    const clamp = (keys: string[] | null): string[] | null => {
      if (!keys) return null;
      if (!allowedKeys) return keys;
      const filtered = keys.filter(k => allowedKeys.includes(k));
      return filtered.length > 0 ? filtered : null;
    };

    const userVisible = clamp(userPref.visible_keys || null);
    const userExport  = clamp(userPref.export_keys  || null);
    const adminDefault = admin.default_keys || null;
    const adminExport  = clamp(admin.export_keys    || null);

    return NextResponse.json({
      gridId,
      allowedKeys,                                        // what users may ever see/export
      adminDefault,                                       // admin default visible columns
      adminExportKeys: adminExport,
      userPref: userVisible,
      userExportKeys: userExport,
      effective:       userVisible  || adminDefault,      // final visible cols (null = use all allowed/columns)
      effectiveExport: userExport   || adminExport,
      settings: admin.settings || {},                     // { show_search, show_footer, show_excel }
    });
  } catch (err: any) {
    console.error("GET /api/grid-prefs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/grid-prefs
 * Body: { grid, user?, visible_keys?, export_keys?, allowed_keys?, settings?, admin? }
 *
 * admin=true  → updates grid_defaults
 * user provided → updates grid_user_prefs (visible/export only, clamped to allowed)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { grid, user, visible_keys, export_keys, allowed_keys, settings, admin } = body;
    if (!grid) return NextResponse.json({ error: "grid required" }, { status: 400 });

    if (admin) {
      // Read current row so we only overwrite what was passed
      const cur = (await db.query(`SELECT default_keys, allowed_keys, export_keys, settings FROM grid_defaults WHERE grid_id = $1`, [grid])).rows[0] || {};

      const newDefaultKeys  = visible_keys  !== undefined ? visible_keys  : (cur.default_keys  ?? null);
      const newAllowedKeys  = allowed_keys  !== undefined ? allowed_keys  : (cur.allowed_keys  ?? null);
      const newExportKeys   = export_keys   !== undefined ? export_keys   : (cur.export_keys   ?? null);
      const newSettings     = settings      !== undefined ? settings      : (cur.settings      ?? {});

      await db.query(
        `INSERT INTO grid_defaults (grid_id, default_keys, allowed_keys, export_keys, settings, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (grid_id) DO UPDATE SET
           default_keys = $2,
           allowed_keys = $3,
           export_keys  = $4,
           settings     = $5,
           updated_by   = $6,
           updated_at   = NOW()`,
        [grid, newDefaultKeys, newAllowedKeys, newExportKeys, newSettings, user || "system"]
      );
      return NextResponse.json({ ok: true, type: "admin", grid });
    }

    if (user) {
      if (visible_keys === null && export_keys === null) {
        await db.query(`DELETE FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`, [grid, user]);
        return NextResponse.json({ ok: true, type: "reset", grid, user });
      }

      const existing = await db.query(
        `SELECT visible_keys, export_keys FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`,
        [grid, user]
      );
      const cur = existing.rows[0] || {};
      const newVisible = visible_keys !== undefined ? visible_keys : (cur.visible_keys || null);
      const newExport  = export_keys  !== undefined ? export_keys  : (cur.export_keys  || null);

      if (newVisible === null && newExport === null) {
        await db.query(`DELETE FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`, [grid, user]);
      } else {
        await db.query(
          `INSERT INTO grid_user_prefs (grid_id, user_id, visible_keys, export_keys, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (grid_id, user_id) DO UPDATE
           SET visible_keys = COALESCE($3, grid_user_prefs.visible_keys),
               export_keys  = COALESCE($4, grid_user_prefs.export_keys),
               updated_at   = NOW()`,
          [grid, user, newVisible, newExport]
        );
      }
      return NextResponse.json({ ok: true, type: "user", grid, user });
    }

    return NextResponse.json({ error: "user or admin flag required" }, { status: 400 });
  } catch (err: any) {
    console.error("PUT /api/grid-prefs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
