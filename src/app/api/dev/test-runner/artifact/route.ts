import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readRunArtifact } from "@/lib/dev/testRunner";

export const runtime = "nodejs";

function mimeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".md") || lower.endsWith(".log") || lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

export async function GET(req: NextRequest) {
  const userId = getCurrentUser(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = req.nextUrl.searchParams.get("runId") ?? "";
  const relativePath = req.nextUrl.searchParams.get("path") ?? "";
  if (!runId || !relativePath) {
    return NextResponse.json({ error: "Missing runId or path" }, { status: 400 });
  }

  try {
    const { filePath, buffer } = await readRunArtifact(runId, relativePath);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeFor(filePath),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read artifact" }, { status: 400 });
  }
}
