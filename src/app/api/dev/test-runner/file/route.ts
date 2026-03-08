import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readSpecFile, writeSpecFile } from "@/lib/dev/testRunner";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const content = await readSpecFile(path);
    return NextResponse.json({ path, content });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read file" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { path?: string; content?: string } | null;
  if (!body?.path || typeof body.content !== "string") {
    return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
  }

  try {
    await writeSpecFile(body.path, body.content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save file" }, { status: 400 });
  }
}
