import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearRuns, deleteRun, listRuns, listSpecFiles, startRun } from "@/lib/dev/testRunner";

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

  const body = await req.json().catch(() => ({} as { specPath?: string | null; target?: "spec" | "suite" | "last-failed" }));
  const target = body.target === "last-failed" ? "last-failed" : body.target === "spec" ? "spec" : body.target === "suite" ? "suite" : (body.specPath ? "spec" : "suite");
  const run = await startRun(body.specPath ?? null, target);
  return NextResponse.json(run, { status: 202 });
}

export async function DELETE(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = req.nextUrl.searchParams.get("runId");
  try {
    if (runId) {
      await deleteRun(runId);
    } else {
      await clearRuns();
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete run";
    const status = message.includes("running") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
