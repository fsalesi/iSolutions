import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

function clearCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

function loggedOutUrl(req: NextRequest): string {
  // Prefer the forwarded host (public domain) over the internal hostname
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}/logged-out`;
}

// GET — browser navigation (links, SSO logout redirect)
export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(loggedOutUrl(req));
  clearCookie(response);
  return response;
}

// POST — called by SessionContext.logout() in the client
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearCookie(response);
  return response;
}
