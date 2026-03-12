/**
 * BeGLService — TypeScript facade over OE beglacct.p / beglaccteam.p calls.
 */

import { DomainMgr } from "../DomainMgr";
import { getSystemSetting } from "@/lib/settings";

const DELIM = "\u0003";

export interface GLAccountRecord {
  code: string;
  description: string;
  active: boolean;
  domain: string;
}

export interface GLSubAccountRecord {
  code: string;
  description: string;
  active: boolean;
  domain: string;
}

export interface GLDeptRecord {
  code: string;
  description: string;
  active: boolean;
  domain: string;
}

export interface GLProjectSearch {
  dept?: string;
  account?: string;
  query?: string;
}

export interface GLProjectRecord {
  code: string;
  description: string;
  active: boolean;
  domain: string;
  beginDate: string | null;
  revisedFinishDate: string | null;
  finishDate: string | null;
  projectManager: string;
}

export interface GLAllocationCode {
  code: string;
  description: string;
}

export interface GLValidSubRow {
  subAccount: string;
  account: string;
  valid?: boolean;
}

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === "yes" || value === 1 || value === "1";
}

async function useEamAccounts(domain?: string): Promise<boolean> {
  const value = await getSystemSetting("USE_EAM_ACCOUNTS", domain ? { domain } : {});
  return String(value || "").toLowerCase() === "true";
}

async function resolveProcedure(base: string, eam: string, domain: string): Promise<string> {
  return (await useEamAccounts(domain)) ? eam : base;
}

function flattenAccount(row: any): GLAccountRecord {
  return {
    code: row.ttac_code || "",
    description: row.ttac_desc || "",
    active: toBool(row.ttac_active),
    domain: row.ttac_domain || "",
  };
}

function flattenSubAccount(row: any): GLSubAccountRecord {
  return {
    code: row.ttsb_sub || "",
    description: row.ttsb_desc || "",
    active: toBool(row.ttsb_active),
    domain: row.ttsb_domain || "",
  };
}

function flattenDept(row: any): GLDeptRecord {
  return {
    code: row.ttcc_ctr || "",
    description: row.ttcc_desc || "",
    active: toBool(row.ttcc_active),
    domain: row.ttcc_domain || "",
  };
}

function buildProjectInput(search: GLProjectSearch | string): string {
  if (typeof search === "string") {
    if (search.includes(DELIM)) return search;
    return `${DELIM}${DELIM}${search}`;
  }
  return `${search.dept || ""}${DELIM}${search.account || ""}${DELIM}${search.query || ""}`;
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildDsGlValidSubXml(rows: GLValidSubRow[]): string {
  const rowXml = rows
    .map(
      (row) =>
        `  <ttValidSub><ttSub>${xmlEscape(row.subAccount)}</ttSub><ttAcct>${xmlEscape(row.account)}</ttAcct><ttValid>${xmlEscape(row.valid ?? false)}</ttValid></ttValidSub>`,
    )
    .join("\n");
  return `<?xml version="1.0"?>\n<dsGL xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${rowXml}\n</dsGL>`;
}

function flattenProject(row: any): GLProjectRecord {
  return {
    code: row.ttpj_project || "",
    description: row.ttpj_desc || "",
    active: toBool(row.ttpj_active),
    domain: row.ttpj_domain || "",
    beginDate: row.ttpj_beg_dt || null,
    revisedFinishDate: row.ttpj_revfin || null,
    finishDate: row.ttpj_findate || null,
    projectManager: row.ttpj_pm || "",
  };
}

export class BeGLService {
  static async isValidSubAccount(subAccount: string, account: string, budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<boolean> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p"
      ? `${subAccount}${DELIM}${account}${DELIM}${budgetCode}${DELIM}${reqType}${DELIM}${site}`
      : `${subAccount}${DELIM}${account}`;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beIsValidSubAcct",
      input,
      domain,
      userId,
      datasetMode: "junk",
    });
    return toBool(raw.output || raw["return-value"] || "");
  }

  static async isValidSubAccountTT(rows: GLValidSubRow[], budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<{ rows: GLValidSubRow[]; output: string; raw: any }> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p"
      ? `${budgetCode}${DELIM}${reqType}${DELIM}${site}`
      : "";
    const raw = await DomainMgr.call({
      procedure,
      entry: "beIsValidSubAcctTT",
      input,
      domain,
      userId,
      datasetMode: "typed",
      datasetName: "dsGL",
      datasetXml: buildDsGlValidSubXml(rows),
    });
    const outRows = (raw.ttValidSub || []).map((row: any) => ({
      subAccount: row.ttSub || "",
      account: row.ttAcct || "",
      valid: toBool(row.ttValid),
    }));
    return { rows: outRows, output: raw.output || raw["return-value"] || "", raw };
  }

  static async isValidAccount(account: string, subAccount: string, dept: string, project: string, budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<string> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    let input = `${account}${DELIM}${subAccount}${DELIM}${dept}${DELIM}${project}${DELIM}${site}`;
    if (procedure === "beglaccteam.p") {
      input += `${DELIM}${budgetCode}${DELIM}${reqType}${DELIM}${site}`;
    }
    const raw = await DomainMgr.call({
      procedure,
      entry: "beIsValidAccount",
      input,
      domain,
      userId,
      datasetMode: "junk",
    });
    return raw.output || raw["return-value"] || "";
  }

  static async getAccount(account: string, site: string, domain: string, userId?: string): Promise<GLAccountRecord | null> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p" ? `${account}${DELIM}${site}` : account;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beGetAccount",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttac_mstr?.[0];
    return row ? flattenAccount(row) : null;
  }

  static async listAccountsForDept(dept: string, budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<GLAccountRecord[]> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p"
      ? `${dept}${DELIM}${budgetCode}${DELIM}${reqType}${DELIM}${site}`
      : dept;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beListAccountsForDept",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttac_mstr || []).map(flattenAccount);
  }

  static async getSubAccount(subAccount: string, site: string, domain: string, userId?: string): Promise<GLSubAccountRecord | null> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p" ? `${subAccount}${DELIM}${site}` : subAccount;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beGetSubAccount",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttsb_mstr?.[0];
    return row ? flattenSubAccount(row) : null;
  }

  static async listSubAccountsForDept(dept: string, budgetCode: string, reqType: string, site: string, account: string, domain: string, userId?: string): Promise<GLSubAccountRecord[]> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p"
      ? `${dept}${DELIM}${budgetCode}${DELIM}${reqType}${DELIM}${site}${DELIM}${account}`
      : `${dept}${DELIM}${account}`;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beListSubAccountsForDept",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttsb_mstr || []).map(flattenSubAccount);
  }

  static async getDept(dept: string, site: string, domain: string, userId?: string): Promise<GLDeptRecord | null> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p" ? `${dept}${DELIM}${site}` : dept;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beGetDept",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttcc_mstr?.[0];
    return row ? flattenDept(row) : null;
  }

  static async listActiveDepts(budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<GLDeptRecord[]> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p" ? `${budgetCode}${DELIM}${reqType}${DELIM}${site}` : "";
    const raw = await DomainMgr.call({
      procedure,
      entry: "beListActiveDept",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttcc_mstr || []).map(flattenDept);
  }

  static async listDepts(search: string, budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<GLDeptRecord[]> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p"
      ? `${search}${DELIM}${budgetCode}${DELIM}${reqType}${DELIM}${site}`
      : search;
    const raw = await DomainMgr.call({
      procedure,
      entry: "beListDepts",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttcc_mstr || []).map(flattenDept);
  }

  static async listAllDepts(budgetCode: string, reqType: string, site: string, domain: string, userId?: string): Promise<GLDeptRecord[]> {
    const procedure = await resolveProcedure("beglacct.p", "beglaccteam.p", domain);
    const input = procedure === "beglaccteam.p" ? `${budgetCode}${DELIM}${reqType}${DELIM}${site}` : "";
    const raw = await DomainMgr.call({
      procedure,
      entry: "beListAllDept",
      input,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttcc_mstr || []).map(flattenDept);
  }

  static async getProject(project: string, domain: string, userId?: string): Promise<GLProjectRecord | null> {
    const raw = await DomainMgr.call({
      procedure: "beglacct.p",
      entry: "beGetProject",
      input: project,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttpj_mstr?.[0];
    return row ? flattenProject(row) : null;
  }

  static async listProjects(search: GLProjectSearch | string, domain: string, userId?: string): Promise<GLProjectRecord[]> {
    const raw = await DomainMgr.call({
      procedure: "beglacct.p",
      entry: "beListProjects",
      input: buildProjectInput(search),
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttpj_mstr || []).map(flattenProject);
  }

  static async getAllocationCodes(domain: string, userId?: string): Promise<GLAllocationCode[]> {
    const raw = await DomainMgr.call({
      procedure: "beglacct.p",
      entry: "beGetAllocationCodes",
      input: "",
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttal_mstr || []).map((row: any) => ({
      code: row.al_code || "",
      description: row.al_desc || "",
    }));
  }
}
