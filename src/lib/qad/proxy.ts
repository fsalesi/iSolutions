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

export interface GetDataDatasetDefinition {
  name: string;
  primaryTable: string;
  moreTables?: Array<{
    name: string;
    parentTable?: string;
    whereClause?: string;
    includeFields?: string[] | string;
    excludeFields?: string[] | string;
  }>;
}

export interface GetDataParams {
  table?: string;
  dataset?: GetDataDatasetDefinition;
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

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function jsonToXml(value: unknown, name?: string): string {
  const render = (node: unknown, nodeName: string, indent: string): string => {
    if (Array.isArray(node)) {
      return node.map((item) => render(item, nodeName, indent + "	")).join("\n");
    }

    if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      let hasChild = false;
      let xml = `${indent}<${nodeName}`;

      for (const key of Object.keys(record)) {
        if (key.startsWith("@")) {
          xml += ` ${key.slice(1)}="${escapeXml(String(record[key] ?? ""))}"`;
        } else {
          hasChild = true;
        }
      }

      xml += hasChild ? ">" : "/>";
      if (hasChild) {
        for (const key of Object.keys(record)) {
          if (key === "#text") {
            xml += String(record[key] ?? "");
          } else if (key === "#cdata") {
            xml += `<![CDATA[${String(record[key] ?? "")}]]>`;
          } else if (!key.startsWith("@")) {
            xml += render(record[key], key, indent + "	");
          }
        }
        xml += (xml.endsWith("\n") ? indent : "") + `</${nodeName}>`;
      }
      return xml;
    }

    return `${indent}<${nodeName}>${escapeXml(String(node ?? ""))}</${nodeName}>`;
  };

  if (name) {
    return render(value, name, "").replace(/[\t\n]/g, "");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  return Object.entries(value as Record<string, unknown>)
    .map(([key, child]) => render(child, key, ""))
    .join("")
    .replace(/[\t\n]/g, "");
}

function buildConfigXml(dataset: GetDataDatasetDefinition): string {
  const more = dataset.moreTables || [];
  const dataSetTable: Record<string, unknown> = {
    ibTableName: dataset.primaryTable,
    ibTableSequence: 1,
    ibRepositionMode: false,
    ibNested: true,
  };

  if (more.length === 1) {
    const table = more[0];
    dataSetTable.ibDSTMoreTables = {
      ibTableName: table.name,
      ibMoreTableSequence: 1,
      ibParentTable: table.parentTable || dataset.primaryTable,
      ibQuery: normalizeWhereClauseOperators(table.whereClause),
    };
  } else if (more.length > 1) {
    dataSetTable.ibDSTMoreTables = more.map((table, index) => ({
      ibTableName: table.name,
      ibMoreTableSequence: index + 1,
      ibParentTable: table.parentTable || dataset.primaryTable,
      ibQuery: normalizeWhereClauseOperators(table.whereClause),
    }));
  }

  return jsonToXml({
    ibDataSet: {
      ibDatasetName: dataset.name,
      ibDataSetTable: dataSetTable,
    },
  });
}


function parseConfigXmlDefinition(configxml: string): GetDataDatasetDefinition | null {
  const xml = (configxml || '').trim();
  if (!xml) return null;

  const dsMatch = xml.match(/<ibDataSet\s+ibDatasetName="([^"]+)"/i);
  const tableMatch = xml.match(/<ibDataSetTable\s+ibTableName="([^"]+)"/i);
  if (!dsMatch || !tableMatch) return null;

  const dataset: GetDataDatasetDefinition = {
    name: dsMatch[1],
    primaryTable: tableMatch[1],
    moreTables: [],
  };

  const moreTableRegex = /<ibDSTMoreTables\s+ibTableName="([^"]+)">([\s\S]*?)<\/ibDSTMoreTables>/gi;
  let m;
  while ((m = moreTableRegex.exec(xml)) !== null) {
    const block = m[2] || '';
    const parentMatch = block.match(/<ibParentTable>([\s\S]*?)<\/ibParentTable>/i);
    const queryMatch = block.match(/<ibQuery>([\s\S]*?)<\/ibQuery>/i);
    dataset.moreTables!.push({
      name: m[1],
      parentTable: parentMatch ? parentMatch[1].trim() : dataset.primaryTable,
      whereClause: queryMatch ? queryMatch[1].trim() : '',
    });
  }

  return dataset;
}

function buildGetDataPayload(params: GetDataParams) {
  const dsName = (params.dsName || params.dataset?.name || params.table || '').trim();
  const requestRow: Record<string, any> = {
    dsName,
    whereClause: normalizeWhereClauseOperators(params.whereClause),
    restartRowid: params.restartRowid || '',
    numRecords: typeof params.numRecords === 'number' ? params.numRecords : 0,
    fieldSet: joinList(params.fieldSet),
    outputFormat: params.outputFormat || 'json',
    isQAD: true,
  };

  if (params.sort) requestRow.Sort = params.sort;
  if (params.dir) requestRow.Dir = params.dir;
  if (params.rowid) requestRow.Rowid = params.rowid;
  if (params.query) requestRow.Query = params.query;
  if (params.queryFields) requestRow.Fields = joinList(params.queryFields);
  if (params.filter) requestRow.Filter = params.filter;
  if (params.includeSchema) requestRow.includeSchema = true;
  if (params.dictdb) requestRow.DictDb = params.dictdb;
  if (params.reverse) requestRow.Reverse = true;

  let configxml = (params.configxml || '').trim();
  const payload: Record<string, any> = {
    iBridge: {
      ibRequest: [requestRow],
    },
  };

  const derivedDataset = params.dataset || parseConfigXmlDefinition(configxml || '') || undefined;

  if (derivedDataset || configxml) {
    const datasetName = derivedDataset?.name || dsName;
    const primaryTable = derivedDataset?.primaryTable || params.table || '';
    const more = derivedDataset?.moreTables || [];
    const tableNode: Record<string, any> = {
      ibDataSetName: datasetName,
      ibTableSequence: 1,
      ibTableName: primaryTable,
      ibRepositionMode: false,
      ibNested: true,
    };

    if (more.length) {
      tableNode.ibDSTMoreTables = more.map((table, index) => ({
        ibDataSetName: datasetName,
        ibTableSequence: 1,
        ibMoreTableSequence: index + 1,
        ibTableName: table.name,
        ibParentTable: table.parentTable || primaryTable,
        ibQuery: normalizeWhereClauseOperators(table.whereClause),
      }));
    }

    payload.iBridge.ibDataSet = [
      {
        ibDatasetName: datasetName,
        ibDataSetTable: [tableNode],
      },
    ];

    if (!configxml && derivedDataset) {
      const moreXml = more.length ? more.map((table, index) => ({
        '@ibTableName': table.name,
        ibMoreTableSequence: index + 1,
        ibParentTable: table.parentTable || primaryTable,
        ibQuery: normalizeWhereClauseOperators(table.whereClause),
      })) : undefined;
      configxml = jsonToXml({
        ibDataSet: {
          '@ibDatasetName': datasetName,
          ibDataSetTable: {
            '@ibTableName': primaryTable,
            ibTableSequence: 1,
            ibRepositionMode: false,
            ibNested: true,
            ...(moreXml ? { ibDSTMoreTables: moreXml.length === 1 ? moreXml[0] : moreXml } : {}),
          },
        },
      });
    }
  }

  if (configxml) {
    requestRow.configxml = configxml;
  }

  return {
    table: params.table || params.dataset?.primaryTable || '',
    payload,
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

  return {
    dataset: raw?.dataset || raw || {},
    rows: table ? ((raw?.dataset?.[table] || raw?.[table] || []) as any[]) : [],
    raw,
  };
}
