import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/sso";

// Intermediate same-site redirect after SSO callback.
// The callback sets the session cookie and redirects here first,
// ensuring the cookie is established before the browser navigates to /.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(`${getOrigin(req)}/`);
}
