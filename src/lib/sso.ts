import { NextRequest } from "next/server";
import { getSystemSetting } from "./settings";

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  logoffUrl: string;
  scope: string;
}

export interface ProviderMeta {
  id: string;
  label: string;
}

/**
 * Returns the public origin (scheme + host) for the request.
 * Respects X-Forwarded-Proto and X-Forwarded-Host set by Nginx Proxy Manager.
 */
export function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host  = req.headers.get("x-forwarded-host")  ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export type SSOState =
  | { mode: "off" }
  | { mode: "choice"; providers: string[] }   // SSO_LOGIN=true, SSO_CHOICE set
  | { mode: "auto" };                          // SSO_LOGIN=true, SSO_CHOICE blank -> use generic settings

/** Reads SSO_LOGIN and SSO_CHOICE and returns the login mode */
export async function getSSOState(): Promise<SSOState> {
  const [login, choice] = await Promise.all([
    getSystemSetting("SSO_LOGIN"),
    getSystemSetting("SSO_CHOICE"),
  ]);

  if (login?.toLowerCase() !== "true") return { mode: "off" };

  const providers = (choice ?? "")
    .split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);

  if (providers.length > 0) return { mode: "choice", providers };
  return { mode: "auto" };
}

/** Loads provider config from settings table. Returns null if not configured or secret is a placeholder.
 *  Pass provider="generic" to use the unprefixed SSO_* settings (SSO_LOGIN=true, SSO_CHOICE blank). */
export async function getProviderConfig(provider: string): Promise<ProviderConfig | null> {
  const isGeneric = provider === "generic";
  const P = provider.toUpperCase();
  const s = (name: string) => isGeneric ? name : `${name}_${P}`;

  const [clientId, clientSecret, authUrl, tokenUrl, logoffUrl] = await Promise.all([
    getSystemSetting(s("SSO_CLIENT_ID")),
    getSystemSetting(s("SSO_CLIENT_SECRET")),
    getSystemSetting(s("SSO_AUTHORIZATION_URL")),
    getSystemSetting(s("SSO_TOKEN_URL")),
    getSystemSetting(s("SSO_LOGOFF_URL")),
  ]);

  if (!clientId || !clientSecret || !authUrl || !tokenUrl) return null;
  if (clientSecret.startsWith("REPLACE_WITH")) return null;

  const scopes: Record<string, string> = {
    MICROSOFT: "openid email profile",
    GOOGLE:    "openid email profile",
    OKTA:      "openid email profile",
  };

  return {
    clientId,
    clientSecret,
    authorizationUrl: authUrl,
    tokenUrl,
    logoffUrl: logoffUrl ?? "",
    scope: scopes[P] ?? "openid email profile",
  };
}

/**
 * Decode a JWT payload without signature verification.
 * Safe here because the token arrives directly from the IdP token endpoint over HTTPS.
 */
export function decodeJwtPayload(token: string): Record<string, any> {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

export const PROVIDER_META: Record<string, { label: string }> = {
  microsoft: { label: "Microsoft" },
  google:    { label: "Google"    },
  okta:      { label: "Okta"      },
};
