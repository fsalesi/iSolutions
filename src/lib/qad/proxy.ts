/**
 * QAD PASOE Proxy — single point of contact for all QAD REST calls.
 *
 * Reads broker config from `pasoe_brokers` and credentials from system settings.
 * All QAD communication flows through callQAD() or getQADData().
 *
 * See /docs/QAD.md for full architecture documentation.
 */

import { db } from "@/lib/db";
import { getSystemSetting } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QADCallParams {
  /** .p procedure file (e.g. "besupplier.p") */
  procedure: string;
  /** Entry point / method name (e.g. "beListSuppliers"). Blank for getData.p. */
  entry?: string;
  /** Input parameter(s) passed to the procedure */
  input?: string;
  /** Domain code (e.g. "DEMO1") — used to look up the correct broker */
  domain: string;
  /** User ID for context (defaults to "SYSTEM") */
  userId?: string;
  /** Optional longchar payload (used by getData.p / iBridge) */
  longchar?: string;
}

export interface GetDataParams {
  /** QAD table name (e.g. "cc_mstr", "ac_mstr") */
  dsName: string;
  /** Progress 4GL WHERE clause */
  whereClause: string;
  /** Comma-separated field names */
  fieldSet: string;
  /** Max rows to return */
  numRecords?: number;
  /** Domain code */
  domain: string;
  /** User ID for context */
  userId?: string;
}

export class QADProxyError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "QADProxyError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Broker config cache (in-memory, keyed by domain)
// ---------------------------------------------------------------------------

interface BrokerConfig {
  connectString: string;
  cachedAt: number;
}

const brokerCache = new Map<string, BrokerConfig>();
const BROKER_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getBroker(domain: string): Promise<string> {
  const upper = domain.toUpperCase();
  const cached = brokerCache.get(upper);
  if (cached && Date.now() - cached.cachedAt < BROKER_TTL_MS) {
    return cached.connectString;
  }

  const { rows } = await db.query(
    `SELECT connect_string FROM pasoe_brokers WHERE domain = $1 LIMIT 1`,
    [upper]
  );

  if (rows.length === 0) {
    throw new QADProxyError(`No PASOE broker configured for domain "${upper}"`, 404);
  }

  const connectString = rows[0].connect_string;
  if (!connectString) {
    throw new QADProxyError(`Broker for domain "${upper}" has no connect_string`, 500);
  }

  brokerCache.set(upper, { connectString, cachedAt: Date.now() });
  return connectString;
}

// ---------------------------------------------------------------------------
// Credentials cache
// ---------------------------------------------------------------------------

let credCache: { user: string; pass: string; cachedAt: number } | null = null;
const CRED_TTL_MS = 5 * 60 * 1000;

async function getCredentials(): Promise<{ user: string; pass: string }> {
  if (credCache && Date.now() - credCache.cachedAt < CRED_TTL_MS) {
    return { user: credCache.user, pass: credCache.pass };
  }

  const [user, pass] = await Promise.all([
    getSystemSetting("QAD_USERNAME"),
    getSystemSetting("QAD_PASSWORD"),
  ]);

  if (!user || !pass) {
    throw new QADProxyError("QAD_USERNAME or QAD_PASSWORD system setting not configured", 500);
  }

  credCache = { user, pass, cachedAt: Date.now() };
  return { user, pass };
}

// ---------------------------------------------------------------------------
// callQAD — dedicated BE calls
// ---------------------------------------------------------------------------

/**
 * Call a QAD Business Entity procedure via PASOE REST.
 *
 * @returns The parsed JSON response body (raw ProDataSet)
 */
export async function callQAD(params: QADCallParams): Promise<any> {
  const { procedure, entry = "", input = "", domain, userId = "SYSTEM", longchar } = params;

  const baseUrl = await getBroker(domain);
  const creds = await getCredentials();

  const url = baseUrl.replace(/\/+$/, "");

  const body: any = {
    procedure,
    entry,
    input,
    context: {
      domain: domain.toLowerCase(),
      userid: userId.toLowerCase(),
      qadUser: creds.user,
      qadPass: creds.pass,
      dateFormat: "mdy",
    },
  };

  if (longchar) {
    body.longchar = longchar;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });
  } catch (err: any) {
    if (err.name === "TimeoutError") {
      throw new QADProxyError(`QAD call timed out: ${procedure}/${entry}`, 504);
    }
    throw new QADProxyError(`QAD connection failed: ${err.message}`, 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new QADProxyError(
      `QAD returned ${res.status}: ${text.slice(0, 200)}`,
      res.status >= 500 ? 502 : res.status
    );
  }

  const text = await res.text();
  if (!text || !text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new QADProxyError(`QAD returned invalid JSON: ${text.slice(0, 200)}`, 502);
  }
}

// ---------------------------------------------------------------------------
// getQADData — generic getData.p / iBridge calls
// ---------------------------------------------------------------------------

/**
 * Query any QAD table via the generic getData.p iBridge mechanism.
 *
 * @returns Array of row objects
 */
export async function getQADData(params: GetDataParams): Promise<any[]> {
  const { dsName, whereClause, fieldSet, numRecords = 100, domain, userId } = params;

  const iBridge = {
    iBridge: {
      ibRequest: [
        {
          dsName,
          whereClause,
          numRecords,
          fieldSet,
          outputFormat: "json",
          isQAD: false,
        },
      ],
    },
  };

  const raw = await callQAD({
    procedure: "getData.p",
    entry: "",
    input: "",
    domain,
    userId,
    longchar: JSON.stringify(iBridge),
  });

  // getData.p returns { tableName: [...rows] }
  return raw[dsName] || [];
}
