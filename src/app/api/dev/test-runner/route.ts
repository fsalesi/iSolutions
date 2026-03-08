import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listRuns, listSpecFiles, startRun } from "@/lib/dev/testRunner";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [specs, runs] = await Promise.all([listSpecFiles(), listRuns()]);
  return NextResponse.json({ specs, runs });
}

export async function POST(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { specPath?: string | null }));
  const run = await startRun(body.specPath ?? null);
  return NextResponse.json(run, { status: 202 });
}
