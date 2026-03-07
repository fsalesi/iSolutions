import { NextRequest } from "next/server";
import { db } from "./db";

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

interface SSOConfigRow {
  provider_id: string;
  label: string;
  is_active: boolean;
  show_on_login: boolean;
  client_id: string;
  client_secret: string;
  authorization_url: string;
  token_url: string;
  logoff_url: string;
  scope: string;
}

/**
 * Returns the public origin (scheme + host) for the request.
 * Respects X-Forwarded-Proto and X-Forwarded-Host set by Nginx Proxy Manager.
 */
export function getOrigin(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export type SSOState =
  | { mode: "off" }
  | { mode: "choice"; providers: string[] }
  | { mode: "auto"; provider: string };

function normalizeProviderId(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function isConfigured(row: Pick<SSOConfigRow, "client_id" | "client_secret" | "authorization_url" | "token_url">): boolean {
  const secret = String(row.client_secret || "");
  return !!(
    row.client_id &&
    secret &&
    row.authorization_url &&
    row.token_url &&
    !secret.startsWith("REPLACE_WITH")
  );
}

async function loadActiveRows(): Promise<SSOConfigRow[]> {
  const { rows } = await db.query(
    `SELECT provider_id, label, is_active, show_on_login,
            client_id, client_secret, authorization_url, token_url, logoff_url, scope
       FROM sso_config
      WHERE COALESCE(is_active, false) = true
      ORDER BY CASE WHEN LOWER(provider_id) = 'generic' THEN 0 ELSE 1 END, provider_id`
  );
  return rows as SSOConfigRow[];
}

/** Returns login mode from sso_config rows */
export async function getSSOState(): Promise<SSOState> {
  const active = (await loadActiveRows()).filter(isConfigured);
  if (active.length === 0) return { mode: "off" };

  const choiceProviders = active
    .filter((r) => r.show_on_login)
    .map((r) => normalizeProviderId(r.provider_id));

  if (choiceProviders.length > 0) {
    return { mode: "choice", providers: choiceProviders };
  }

  // Auto mode: prefer generic, else first active configured provider
  const autoProvider = normalizeProviderId(active[0].provider_id);
  return { mode: "auto", provider: autoProvider };
}

/** Loads provider config from sso_config */
export async function getProviderConfig(provider: string): Promise<ProviderConfig | null> {
  const id = normalizeProviderId(provider);
  if (!id) return null;

  const { rows } = await db.query(
    `SELECT provider_id, label, is_active, show_on_login,
            client_id, client_secret, authorization_url, token_url, logoff_url, scope
       FROM sso_config
      WHERE LOWER(provider_id) = LOWER($1)
      LIMIT 1`,
    [id]
  );

  if (!rows.length) return null;
  const row = rows[0] as SSOConfigRow;
  if (!row.is_active) return null;
  if (!isConfigured(row)) return null;

  return {
    clientId: row.client_id,
    clientSecret: row.client_secret,
    authorizationUrl: row.authorization_url,
    tokenUrl: row.token_url,
    logoffUrl: row.logoff_url ?? "",
    scope: row.scope || "openid email profile",
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
  generic: { label: "Single Sign-On" },
  microsoft: { label: "Microsoft" },
  google: { label: "Google" },
  okta: { label: "Okta" },
};
