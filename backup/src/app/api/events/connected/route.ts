import { NextResponse } from "next/server";
import { getConnectedUsers } from "@/lib/sseRegistry";

/**
 * GET /api/events/connected
 * Returns the list of user IDs currently connected via SSE.
 * Useful for debugging and for "is this user online?" checks.
 */
export async function GET() {
  const users = getConnectedUsers();
  return NextResponse.json({ users, count: users.length });
}
