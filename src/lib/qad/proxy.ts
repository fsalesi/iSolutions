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

export type QADDatasetMode = "typed" | "junk" | "none";

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
  /** Dataset contract for the target BE call */
  datasetMode?: QADDatasetMode;
  /** Optional typed dataset name for dataset-in/out calls */
  datasetName?: string;
  /** Optional dataset payload as XML */
  datasetXml?: string;
}

export interface GetDataParams {
  table?: string;
  dsName?: string;
  configxml?: string;
  whereClause?: string;
  fieldSet?: string[] | string;
  outputFormat?: "json" | string;
  numRecords?: number;
  domain: string;
  userId?: string;
  sort?: string;
  dir?: "asc" | "desc" | string;
  restartRowid?: string;
  rowid?: string;
  query?: string;
  queryFields?: string[] | string;
  filter?: string;
  includeSchema?: boolean;
  dictdb?: string;
  reverse?: boolean;
}

export class QADProxyError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "QADProxyError";
    this.status = status;
  }
}

export interface QADFileResult {
  file: string;
  path: string;
  content: string;
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

function joinList(value?: string[] | string): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(",");
  return value || "";
}

function normalizeWhereClauseOperators(input?: string): string {
  const text = (input || "").trim();
  if (!text) return "";

  let out = "";
  let i = 0;
  let inSingle = false;

  while (i < text.length) {
    const ch = text[i];
    if (ch === "'") {
      inSingle = !inSingle;
      out += ch;
      i += 1;
      continue;
    }

    if (!inSingle) {
      const two = text.slice(i, i + 2);
      if (two === ">=") { out += " ge "; i += 2; continue; }
      if (two === "<=") { out += " le "; i += 2; continue; }
      if (two === "<>") { out += " ne "; i += 2; continue; }
      if (two === "!=") { out += " ne "; i += 2; continue; }
      if (ch === "=") { out += " eq "; i += 1; continue; }
      if (ch === ">") { out += " gt "; i += 1; continue; }
      if (ch === "<") { out += " lt "; i += 1; continue; }
    }

    out += ch;
    i += 1;
  }

  return out.replace(/\s+/g, " ").trim();
}

function buildGetDataPayload(params: GetDataParams) {
  const dsName = String(params.dsName || params.table || '').trim();
  const requestRow: Record<string, any> = {
    dsName,
    whereClause: normalizeWhereClauseOperators(params.whereClause),
    numRecords: typeof params.numRecords === 'number' ? params.numRecords : 0,
    fieldSet: joinList(params.fieldSet),
    outputFormat: params.outputFormat || 'json',
    isQAD: false,
  };

  if (params.restartRowid) requestRow.restartRowid = params.restartRowid;
  if (params.sort) requestRow.Sort = params.sort;
  if (params.dir) requestRow.Dir = params.dir;
  if (params.rowid) requestRow.Rowid = params.rowid;
  if (params.query) requestRow.Query = params.query;
  if (params.queryFields) requestRow.Fields = joinList(params.queryFields);
  if (params.filter) requestRow.Filter = params.filter;
  if (params.includeSchema) requestRow.includeSchema = true;
  if (params.dictdb) requestRow.DictDb = params.dictdb;
  if (params.reverse) requestRow.Reverse = true;

  const configxml = String(params.configxml || '').trim();
  if (configxml) {
    requestRow.configxml = configxml;
  }

  return {
    table: String(params.table || '').trim(),
    payload: {
      iBridge: {
        ibRequest: [requestRow],
      },
    },
  };
}


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
  const { procedure, entry = "", input = "", domain, userId = "SYSTEM", longchar, datasetMode = "none", datasetName, datasetXml } = params;

  const baseUrl = await getBroker(domain);
  const creds = await getCredentials();

  const url = baseUrl.replace(/\/+$/, "");

  const body: any = {
    procedure,
    entry,
    input,
    datasetMode,
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
  if (datasetName) {
    body.datasetName = datasetName;
  }
  if (datasetXml) {
    body.datasetXml = datasetXml;
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
// getQADFile — read approved server-side files via ApiHandler GET
// ---------------------------------------------------------------------------

export async function getQADFile(params: { domain: string; file: string }): Promise<QADFileResult> {
  const domain = String(params.domain || '').trim();
  const file = String(params.file || '').trim();

  if (!domain) throw new QADProxyError('domain is required', 400);
  if (!file) throw new QADProxyError('file is required', 400);

  const baseUrl = await getBroker(domain);
  const url = `${baseUrl.replace(/\/+$/, '')}?file=${encodeURIComponent(file)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      throw new QADProxyError(`QAD file fetch timed out: ${file}`, 504);
    }
    throw new QADProxyError(`QAD file fetch failed: ${err.message}`, 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new QADProxyError(
      `QAD file fetch returned ${res.status}: ${text.slice(0, 200)}`,
      res.status >= 500 ? 502 : res.status
    );
  }

  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    throw new QADProxyError('QAD file fetch returned invalid JSON', 502);
  }

  return {
    file: typeof json.file === 'string' ? json.file : file,
    path: typeof json.path === 'string' ? json.path : '',
    content: typeof json.content === 'string' ? json.content : '',
  };
}

// ---------------------------------------------------------------------------
// getQADData — generic getData.p / iBridge calls
// ---------------------------------------------------------------------------

/**
 * Query any QAD table via the generic getData.p iBridge mechanism.
 *
 * @returns Array of row objects
 */
export async function getQADData(params: GetDataParams): Promise<any> {
  const { domain, userId } = params;
  const { table, payload } = buildGetDataPayload(params);

  console.log("QAD getData payload:", JSON.stringify(payload));

  const raw = await callQAD({
    procedure: "getData.p",
    entry: "",
    input: "",
    domain,
    userId,
    datasetMode: "none",
    longchar: JSON.stringify(payload),
  });

  const dataset = raw?.dataset || raw || {};
  const rowSource = String(params.table || params.dsName || table || '').trim();
  const rows = rowSource ? ((dataset?.[rowSource] || raw?.[rowSource] || []) as any[]) : [];

  return {
    dataset,
    rows,
    raw,
  };
}
