import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getProviderConfig, getOrigin } from "@/lib/sso";
import { translateRequest } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")?.toLowerCase();

  if (!provider) {
    return NextResponse.json({ error: await translateRequest(req, "api.auth.sso.missing_provider", "Missing provider") }, { status: 400 });
  }

  const config = await getProviderConfig(provider);
  if (!config) {
    return NextResponse.json({
      error: await translateRequest(
        req,
        "api.auth.sso.provider_not_configured",
        "SSO provider \"{provider}\" is not configured",
        { provider },
      ),
    }, { status: 404 });
  }

  const state       = randomBytes(16).toString("hex");
  const redirectUri = `${getOrigin(req)}/api/auth/callback`;

  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id",     config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("scope",         config.scope);
  url.searchParams.set("state",         state);
  url.searchParams.set("response_mode", "query");

  const response = NextResponse.redirect(url.toString());

  const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  response.cookies.set("sso_state",    state,    cookieOpts);
  response.cookies.set("sso_provider", provider, cookieOpts);

  return response;
}
