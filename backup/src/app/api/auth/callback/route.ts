import { NextRequest, NextResponse } from "next/server";
import { getProviderConfig, decodeJwtPayload, getOrigin } from "@/lib/sso";
import { db } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const origin = getOrigin(req);

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(`${origin}/?sso_error=${encodeURIComponent(msg)}`);

  // ── 1. Read provider + verify CSRF state ──────────────────────────────
  const provider      = req.cookies.get("sso_provider")?.value ?? "";
  const storedState   = req.cookies.get("sso_state")?.value    ?? "";
  const returnedState = searchParams.get("state")              ?? "";

  if (!provider || !storedState || returnedState !== storedState) {
    return errorRedirect("Invalid SSO state. Please try again.");
  }

  // ── 2. Check for IdP-side errors ──────────────────────────────────────
  const idpError = searchParams.get("error");
  if (idpError) {
    return errorRedirect(searchParams.get("error_description") ?? idpError);
  }

  const code = searchParams.get("code");
  if (!code) {
    return errorRedirect("No authorization code returned from identity provider.");
  }

  // ── 3. Load provider config ───────────────────────────────────────────
  const config = await getProviderConfig(provider);
  if (!config) {
    return errorRedirect(`SSO provider "${provider}" is not configured.`);
  }

  // ── 4. Exchange code for tokens ───────────────────────────────────────
  let tokenData: Record<string, any>;
  try {
    const res = await fetch(config.tokenUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  `${origin}/api/auth/callback`,
        client_id:     config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
    });
    tokenData = await res.json();
    if (!res.ok) return errorRedirect(tokenData.error_description ?? "Token exchange failed.");
  } catch {
    return errorRedirect("Failed to contact identity provider.");
  }

  // ── 5. Decode ID token ────────────────────────────────────────────────
  let email: string;
  let displayName: string;
  try {
    const payload = decodeJwtPayload(tokenData.id_token);
    email       = (payload.email ?? payload.preferred_username ?? "").toLowerCase().trim();
    displayName = payload.name ?? email;
    if (!email) throw new Error("No email claim");
  } catch {
    return errorRedirect("Could not read identity from provider.");
  }

  // ── 6. Look up user by email ──────────────────────────────────────────
  let userId: string;
  try {
    const { rows } = await db.query(
      `SELECT user_id, is_active FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return errorRedirect(`No iSolutions account found for ${email}. Please contact your administrator.`);
    }
    if (!rows[0].is_active) {
      return errorRedirect("Your account is disabled. Please contact your administrator.");
    }
    userId = rows[0].user_id;
  } catch {
    return errorRedirect("Database error during login.");
  }

  // ── 7. Set session cookie + clear CSRF cookies ────────────────────────
  // Redirect to an intermediate same-site page first, then to /
  // This avoids browsers dropping cookies set during cross-site redirects (sameSite=lax)
  const response = NextResponse.redirect(`${origin}/api/auth/complete`);

  response.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24,
  });
  response.cookies.set("sso_state",    "", { maxAge: 0, path: "/" });
  response.cookies.set("sso_provider", "", { maxAge: 0, path: "/" });

  console.log(`[sso] ${provider} login: ${displayName} <${email}> → ${userId}`);
  return response;
}
