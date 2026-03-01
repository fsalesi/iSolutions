import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/grid-prefs?grid=users&user=frank
 *
 * Returns visible_keys + export_keys for this grid.
 * Priority: user pref > admin default > null (use client default).
 */
export async function GET(req: NextRequest) {
  try {
    const gridId = req.nextUrl.searchParams.get("grid");
    const userId = req.nextUrl.searchParams.get("user");
    if (!gridId) return NextResponse.json({ error: "grid param required" }, { status: 400 });

    const adminRes = await db.query(
      `SELECT visible_keys, export_keys FROM grid_defaults WHERE grid_id = $1`, [gridId]
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

    return NextResponse.json({
      gridId,
      adminDefault: admin.visible_keys || null,
      adminExportKeys: admin.export_keys || null,
      userPref: userPref.visible_keys || null,
      userExportKeys: userPref.export_keys || null,
      effective: userPref.visible_keys || admin.visible_keys || null,
      effectiveExport: userPref.export_keys || admin.export_keys || null,
    });
  } catch (err: any) {
    console.error("GET /api/grid-prefs error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/grid-prefs
 * Body: { grid, user?, visible_keys?, export_keys?, admin? }
 *
 * admin=true → updates grid_defaults
 * user provided → updates grid_user_prefs
 * visible_keys=null → deletes user's visible pref (reset)
 * export_keys=null → deletes user's export pref (reset)
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { grid, user, visible_keys, export_keys, admin } = body;
    if (!grid) return NextResponse.json({ error: "grid required" }, { status: 400 });

    if (admin) {
      // Build dynamic SET clause based on what's provided
      const sets: string[] = [];
      const vals: any[] = [grid];
      let idx = 2;

      if (visible_keys !== undefined) { sets.push(`visible_keys = $${idx}`); vals.push(visible_keys); idx++; }
      if (export_keys !== undefined) { sets.push(`export_keys = $${idx}`); vals.push(export_keys); idx++; }
      sets.push(`updated_by = $${idx}`); vals.push(user || "system"); idx++;
      sets.push(`updated_at = NOW()`);

      await db.query(
        `INSERT INTO grid_defaults (grid_id, visible_keys, export_keys, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (grid_id) DO UPDATE SET ${sets.join(", ")}`,
        [grid, visible_keys || '{}', export_keys || '{}', user || "system"]
      );
      return NextResponse.json({ ok: true, type: "admin", grid });
    }

    if (user) {
      // Handle reset (null values)
      if (visible_keys === null && export_keys === null) {
        await db.query(`DELETE FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`, [grid, user]);
        return NextResponse.json({ ok: true, type: "reset", grid, user });
      }

      // Upsert — only update fields that are provided
      const existing = await db.query(
        `SELECT visible_keys, export_keys FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`,
        [grid, user]
      );

      const cur = existing.rows[0] || {};
      const newVisible = visible_keys !== undefined ? visible_keys : (cur.visible_keys || null);
      const newExport = export_keys !== undefined ? export_keys : (cur.export_keys || null);

      if (newVisible === null && newExport === null) {
        // Nothing to save, delete row
        await db.query(`DELETE FROM grid_user_prefs WHERE grid_id = $1 AND user_id = $2`, [grid, user]);
      } else {
        await db.query(
          `INSERT INTO grid_user_prefs (grid_id, user_id, visible_keys, export_keys, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (grid_id, user_id) DO UPDATE
           SET visible_keys = COALESCE($3, grid_user_prefs.visible_keys),
               export_keys = COALESCE($4, grid_user_prefs.export_keys),
               updated_at = NOW()`,
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
