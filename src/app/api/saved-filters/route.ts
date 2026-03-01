import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET  /api/saved-filters?userId=X&gridId=Y  — list saved filters
 * POST /api/saved-filters                     — create/upsert a filter
 * DELETE /api/saved-filters?id=N              — delete a filter
 */

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const gridId = req.nextUrl.searchParams.get("gridId");
  if (!userId || !gridId) return NextResponse.json({ error: "userId and gridId required" }, { status: 400 });

  const result = await db.query(
    `SELECT id, name, filters_json, is_default, updated_at
     FROM saved_filters
     WHERE user_id = $1 AND grid_id = $2
     ORDER BY is_default DESC, name ASC`,
    [userId, gridId]
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, gridId, name, filtersJson, isDefault, id } = body;

  if (!userId || !gridId || !name || !filtersJson) {
    return NextResponse.json({ error: "userId, gridId, name, filtersJson required" }, { status: 400 });
  }

  // If setting as default, clear other defaults first
  if (isDefault) {
    await db.query(
      `UPDATE saved_filters SET is_default = false WHERE user_id = $1 AND grid_id = $2`,
      [userId, gridId]
    );
  }

  if (id) {
    // Update existing
    const result = await db.query(
      `UPDATE saved_filters
       SET name = $1, filters_json = $2, is_default = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, is_default`,
      [name, filtersJson, isDefault || false, id, userId]
    );
    return NextResponse.json(result.rows[0] || { error: "not found" });
  } else {
    // Insert or update on conflict (same name)
    const result = await db.query(
      `INSERT INTO saved_filters (user_id, grid_id, name, filters_json, is_default)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, grid_id, name) DO UPDATE
       SET filters_json = $4, is_default = $5, updated_at = NOW()
       RETURNING id, name, is_default`,
      [userId, gridId, name, filtersJson, isDefault || false]
    );
    return NextResponse.json(result.rows[0]);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("userId");
  if (!id || !userId) return NextResponse.json({ error: "id and userId required" }, { status: 400 });

  await db.query(`DELETE FROM saved_filters WHERE id = $1 AND user_id = $2`, [id, userId]);
  return NextResponse.json({ ok: true });
}
