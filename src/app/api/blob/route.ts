import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Generic bytea field endpoint.
 *
 * Convention: every bytea field "foo" has a companion "foo_type" text column
 * holding the MIME type (e.g. photo → photo_type, attachment → attachment_type).
 *
 * Allowlist controls which table.field combinations are accessible.
 * Add entries here as new bytea fields are introduced.
 *
 * GET    /api/blob?table=users&field=photo&oid=<uuid>  — serve binary data
 * POST   /api/blob   body: FormData { table, field, oid, file }  — upload
 * DELETE /api/blob   body: JSON    { table, field, oid }         — clear
 */

// ── Security allowlist ────────────────────────────────────────────────────────
// Format: "table.field"
// Only combinations listed here can be read or written via this endpoint.
const ALLOWED = new Set([
  "users.photo",
  // add future bytea fields here e.g. "po_req.attachment"
]);

// Upload size limit (bytes)
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowed MIME types for uploads (null = accept any)
const ALLOWED_MIME: string[] | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function allow(table: string, field: string): boolean {
  return ALLOWED.has(`${table}.${field}`);
}

function safeIdent(s: string): boolean {
  // Only allow simple identifiers: letters, digits, underscores
  return /^[a-z_][a-z0-9_]*$/.test(s);
}

// ── GET — serve binary data ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const table = searchParams.get("table") || "";
  const field = searchParams.get("field") || "";
  const oid   = searchParams.get("oid")   || "";

  if (!table || !field || !oid)
    return new NextResponse("Missing table, field, or oid", { status: 400 });

  if (!safeIdent(table) || !safeIdent(field))
    return new NextResponse("Invalid identifier", { status: 400 });

  if (!allow(table, field))
    return new NextResponse("Not allowed", { status: 403 });

  try {
    const { rows } = await db.query(
      `SELECT "${field}", "${field}_type" FROM "${table}" WHERE oid = $1::uuid`,
      [oid]
    );
    const row = rows[0];
    if (!row || !row[field]) return new NextResponse(null, { status: 404 });

    return new NextResponse(row[field], {
      headers: {
        "Content-Type": row[`${field}_type`] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}

// ── POST — upload ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  try {
    const form  = await req.formData();
    const table = (form.get("table") as string | null) || "";
    const field = (form.get("field") as string | null) || "";
    const oid   = (form.get("oid")   as string | null) || "";
    const file  = form.get("file") as File | null;

    if (!table || !field || !oid || !file)
      return NextResponse.json({ error: "table, field, oid, and file are required" }, { status: 400 });

    if (!safeIdent(table) || !safeIdent(field))
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });

    if (!allow(table, field))
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    if (ALLOWED_MIME && !ALLOWED_MIME.includes(file.type))
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });

    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    await db.query(
      `UPDATE "${table}"
          SET "${field}" = $1,
              "${field}_type" = $2,
              updated_by = $3,
              updated_at = NOW()
        WHERE oid = $4::uuid`,
      [buffer, file.type, userId, oid]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE — clear field ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  try {
    const { table, field, oid } = await req.json();

    if (!table || !field || !oid)
      return NextResponse.json({ error: "table, field, and oid are required" }, { status: 400 });

    if (!safeIdent(table) || !safeIdent(field))
      return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });

    if (!allow(table, field))
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });

    await db.query(
      `UPDATE "${table}"
          SET "${field}" = NULL,
              "${field}_type" = '',
              updated_by = $1,
              updated_at = NOW()
        WHERE oid = $2::uuid`,
      [userId, oid]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
