// middleware.ts — Enforces authentication on all API routes except /api/auth/*.
// Runs at the edge before any route handler.

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME  = "isolutions-user";

// Routes that are publicly accessible without a session
const PUBLIC_PREFIXES = [
  "/api/auth/",          // login, logout, SSO callbacks
  "/api/auth/me",        // session probe used by the login screen
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard API routes
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // Allow public auth endpoints through
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  // Check session cookie
  const userId = req.cookies.get(COOKIE_NAME)?.value || "";
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
