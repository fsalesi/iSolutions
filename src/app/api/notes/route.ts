import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tableRegex = /^[a-z_][a-z0-9_]*$/i;

/**
 * GET /api/notes?table=x&oid=y  — fetch notes for a record
 * GET /api/notes?table=x&oid=y&count_only=true  — just the count (for badge)
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const table = url.searchParams.get("table")?.trim() || "";
  const oid = url.searchParams.get("oid")?.trim() || "";
  const countOnly = url.searchParams.get("count_only") === "true";

  if (!table || !oid) return NextResponse.json({ error: "table and oid required" }, { status: 400 });
  if (!tableRegex.test(table)) return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  if (!uuidRegex.test(oid)) return NextResponse.json({ error: "Invalid oid" }, { status: 400 });

  if (countOnly) {
    const r = await db.query(
      `SELECT COUNT(*)::int AS total FROM notes WHERE table_name = $1 AND record_oid = $2`,
      [table, oid]
    );
    return NextResponse.json({ count: r.rows[0].total });
  }

  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100")));

  const notesRes = await db.query(
    `SELECT n.id, n.body, n.author, n.created_at,
            COALESCE(u.full_name, n.author) AS author_name, u.oid AS author_oid
     FROM notes n
     LEFT JOIN users u ON n.author = u.user_id
     WHERE n.table_name = $1 AND n.record_oid = $2
     ORDER BY n.created_at ASC, n.id ASC
     LIMIT $3 OFFSET $4`,
    [table, oid, limit, offset]
  );

  // Fetch attachments for all returned notes
  const noteIds = notesRes.rows.map((r: any) => r.id);
  let attachments: any[] = [];
  if (noteIds.length > 0) {
    const attRes = await db.query(
      `SELECT id, note_id, filename, mime_type, file_size
       FROM note_attachments
       WHERE note_id = ANY($1)
       ORDER BY id ASC`,
      [noteIds]
    );
    attachments = attRes.rows;
  }

  // Fetch mentions for all returned notes
  let mentions: any[] = [];
  if (noteIds.length > 0) {
    const mentRes = await db.query(
      `SELECT m.note_id, m.user_id, COALESCE(u.full_name, m.user_id) AS full_name
       FROM note_mentions m
       LEFT JOIN users u ON m.user_id = u.user_id
       WHERE m.note_id = ANY($1)`,
      [noteIds]
    );
    mentions = mentRes.rows;
  }

  // Attach to notes
  const attByNote = new Map<string, any[]>();
  for (const a of attachments) {
    const list = attByNote.get(String(a.note_id)) || [];
    list.push(a);
    attByNote.set(String(a.note_id), list);
  }
  const mentByNote = new Map<string, any[]>();
  for (const m of mentions) {
    const list = mentByNote.get(String(m.note_id)) || [];
    list.push({ user_id: m.user_id, full_name: m.full_name });
    mentByNote.set(String(m.note_id), list);
  }

  const rows = notesRes.rows.map((n: any) => ({
    ...n,
    attachments: attByNote.get(String(n.id)) || [],
    mentions: mentByNote.get(String(n.id)) || [],
  }));

  const countRes = await db.query(
    `SELECT COUNT(*)::int AS total FROM notes WHERE table_name = $1 AND record_oid = $2`,
    [table, oid]
  );

  return NextResponse.json({ rows, total: countRes.rows[0].total, offset, limit });
}

/**
 * POST /api/notes — create a note with optional @mentions
 * Body: { table_name, record_oid, body, mentions?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { table_name, record_oid, body: noteBody, mentions } = body;

    if (!table_name || !record_oid) {
      return NextResponse.json({ error: "table_name and record_oid are required" }, { status: 400 });
    }
    if (!tableRegex.test(table_name)) return NextResponse.json({ error: "Invalid table_name" }, { status: 400 });
    if (!uuidRegex.test(record_oid)) return NextResponse.json({ error: "Invalid record_oid" }, { status: 400 });

    // TODO: get from real auth
    const currentUser = getCurrentUser(req);

    // Insert note
    const noteRes = await db.query(
      `INSERT INTO notes (table_name, record_oid, body, author, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4, $4) RETURNING *`,
      [table_name, record_oid, (noteBody || "").trim(), currentUser]
    );
    const note = noteRes.rows[0];

    // Insert mentions + create notifications
    const mentionList: string[] = Array.isArray(mentions) ? mentions : [];
    const uniqueMentions = [...new Set(mentionList.filter(m => m && m !== currentUser))];

    for (const userId of uniqueMentions) {
      await db.query(
        `INSERT INTO note_mentions (note_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [note.id, userId]
      );
      await db.query(
        `INSERT INTO notifications (user_id, note_id, table_name, record_oid, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [userId, note.id, table_name, record_oid, currentUser]
      );
    }

    // Return the created note with author name
    const fullNote = await db.query(
      `SELECT n.id, n.body, n.author, n.created_at,
              COALESCE(u.full_name, n.author) AS author_name, u.oid AS author_oid
       FROM notes n LEFT JOIN users u ON n.author = u.user_id
       WHERE n.id = $1`,
      [note.id]
    );

    return NextResponse.json({
      ...fullNote.rows[0],
      attachments: [],
      mentions: uniqueMentions.map(u => ({ user_id: u })),
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/notes error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/notes?id=123 — delete own note only
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // TODO: get from real auth
  const currentUser = getCurrentUser(req);

  // Verify ownership
  const check = await db.query(`SELECT author FROM notes WHERE id = $1`, [id]);
  if (!check.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (check.rows[0].author !== currentUser) {
    return NextResponse.json({ error: "You can only delete your own notes" }, { status: 403 });
  }

  // CASCADE handles attachments, mentions, notifications
  await db.query(`DELETE FROM notes WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

/**
 * PUT /api/notes — edit own note body
 * Body: { id, body }
 */
export async function PUT(req: NextRequest) {
  try {
    const { id, body: newBody } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // TODO: get from real auth
    const currentUser = getCurrentUser(req);

    // Verify ownership
    const check = await db.query(`SELECT author FROM notes WHERE id = $1`, [id]);
    if (!check.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (check.rows[0].author !== currentUser) {
      return NextResponse.json({ error: "You can only edit your own notes" }, { status: 403 });
    }

    await db.query(
      `UPDATE notes SET body = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3`,
      [(newBody || "").trim(), currentUser, id]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PUT /api/notes error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
