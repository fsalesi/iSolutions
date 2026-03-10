import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/grid-defaults?grid=users
 * Returns grid_defaults row for this grid_id (or empty defaults).
 */
export async function GET(req: NextRequest) {
  try {
    const gridId = req.nextUrl.searchParams.get("grid");
    if (!gridId) return NextResponse.json({ error: "grid param required" }, { status: 400 });

    const res = await db.query(
      `SELECT grid_id, default_keys, allowed_keys, settings FROM grid_defaults WHERE grid_id = $1`,
      [gridId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ grid_id: gridId, default_keys: null, allowed_keys: null, settings: {} });
    }

    return NextResponse.json(res.rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/grid-defaults
 * Upserts grid_defaults for the given grid_id.
 * Body: { grid_id, default_keys, allowed_keys, settings }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { grid_id, default_keys, allowed_keys, settings } = body;

    if (!grid_id) return NextResponse.json({ error: "grid_id required" }, { status: 400 });

    await db.query(
      `INSERT INTO grid_defaults (grid_id, default_keys, allowed_keys, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (grid_id)
       DO UPDATE SET default_keys = $2, allowed_keys = $3, settings = $4, updated_at = now()`,
      [
        grid_id,
        default_keys || [],
        allowed_keys,
        JSON.stringify(settings || {}),
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
