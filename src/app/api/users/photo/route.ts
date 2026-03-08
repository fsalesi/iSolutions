import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { translateRequest } from "@/lib/i18n/server";

/** POST — upload photo (multipart form: photo file + oid) */
export async function POST(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) return NextResponse.json({ error: await translateRequest(req, "api.auth.not_logged_in", "Not logged in") }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("photo") as File | null;
    const oid = form.get("oid") as string | null;
    if (!file || !oid) return NextResponse.json({ error: await translateRequest(req, "api.users.photo_required", "photo and oid required") }, { status: 400 });

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: await translateRequest(req, "api.users.photo_type", "Only JPEG, PNG, WebP, or GIF") }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: await translateRequest(req, "api.users.photo_size", "Photo must be under 2 MB") }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await db.query(
      `UPDATE users SET photo = $1, photo_type = $2, updated_by = $3, updated_at = NOW()
       WHERE oid = $4::uuid`,
      [buffer, file.type, userId, oid]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** GET — serve photo by ?oid=... */
export async function GET(req: NextRequest) {
  const oid = req.nextUrl.searchParams.get("oid");
  if (!oid) return new NextResponse(await translateRequest(req, "api.users.oid_missing", "Missing oid"), { status: 400 });

  try {
    const { rows } = await db.query(
      `SELECT photo, photo_type FROM users WHERE oid = $1::uuid`,
      [oid]
    );
    if (!rows[0]?.photo) return new NextResponse(null, { status: 404 });

    return new NextResponse(rows[0].photo, {
      headers: {
        "Content-Type": rows[0].photo_type || "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new NextResponse(await translateRequest(req, "api.common.error", "Error"), { status: 500 });
  }
}

/** DELETE — remove photo */
export async function DELETE(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) return NextResponse.json({ error: await translateRequest(req, "api.auth.not_logged_in", "Not logged in") }, { status: 401 });

  try {
    const { oid } = await req.json();
    if (!oid) return NextResponse.json({ error: await translateRequest(req, "api.crud.oid_required", "oid is required") }, { status: 400 });

    await db.query(
      `UPDATE users SET photo = NULL, photo_type = '', updated_by = $1, updated_at = NOW()
       WHERE oid = $2::uuid`,
      [userId, oid]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
