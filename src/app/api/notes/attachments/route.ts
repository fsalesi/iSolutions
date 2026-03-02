import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * POST /api/notes/attachments — upload file to a note
 * FormData: note_id (string), file (File)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const noteId = formData.get("note_id") as string;
    const file = formData.get("file") as File | null;

    if (!noteId || !file) {
      return NextResponse.json({ error: "note_id and file are required" }, { status: 400 });
    }

    // Verify note exists
    const noteCheck = await db.query(`SELECT id FROM notes WHERE id = $1`, [noteId]);
    if (!noteCheck.rows.length) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Read file bytes
    const buffer = Buffer.from(await file.arrayBuffer());

    // TODO: get from real auth
    const currentUser = getCurrentUser(req);

    const res = await db.query(
      `INSERT INTO note_attachments (note_id, filename, mime_type, file_data, file_size, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, note_id, filename, mime_type, file_size`,
      [noteId, file.name, file.type || "application/octet-stream", buffer, buffer.length, currentUser]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: any) {
    console.error("POST /api/notes/attachments error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

/**
 * GET /api/notes/attachments?id=123 — download attachment
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await db.query(
    `SELECT filename, mime_type, file_data FROM note_attachments WHERE id = $1`,
    [id]
  );
  if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { filename, mime_type, file_data } = res.rows[0];

  return new NextResponse(file_data, {
    headers: {
      "Content-Type": mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(file_data.length),
    },
  });
}

/**
 * DELETE /api/notes/attachments?id=123 — delete attachment (author-only)
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const currentUser = getCurrentUser(req); // TODO: real auth

  // Verify ownership via the parent note
  const check = await db.query(
    `SELECT n.author FROM note_attachments a JOIN notes n ON a.note_id = n.id WHERE a.id = $1`,
    [id]
  );
  if (!check.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (check.rows[0].author !== currentUser) {
    return NextResponse.json({ error: "You can only delete your own attachments" }, { status: 403 });
  }

  await db.query(`DELETE FROM note_attachments WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
