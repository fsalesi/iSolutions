/**
 * BePOService — TypeScript facade over OE bepo.p calls.
 */

import { DomainMgr } from "../DomainMgr";

const DELIM = "\u0003";

export interface POHeader {
  poNumber: string;
  domain: string;
  vendor: string;
  vendorName: string;
  buyer: string;
  status: string;
  type: string;
  site: string;
  billTo: string;
  shipTo: string;
  shipVia: string;
  currency: string;
  creditTerms: string;
  remarks: string;
  taxable: boolean;
  hasReceipts: boolean;
  orderDate: string | null;
  dueDate: string | null;
  revision: number | null;
  estimatedValue: number | null;
  recurring: boolean;
  cycle: string;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  exchangeRate: number | null;
  exchangeRate2: number | null;
  fob: string;
}

export interface POLine {
  poNumber: string;
  domain: string;
  line: number | null;
  description: string;
  part: string;
  vendorPart: string;
  site: string;
  account: string;
  subAccount: string;
  costCenter: string;
  project: string;
  status: string;
  uom: string;
  stockUom: string;
  lineType: string;
  revision: string;
  taxable: boolean;
  unitCost: number | null;
  quantityOrdered: number | null;
  quantityReceived: number | null;
  quantityReturned: number | null;
  quantityReleased: number | null;
  quantityChanged: number | null;
  quantityOpen: number | null;
  dueDate: string | null;
  needDate: string | null;
  periodDate: string | null;
  requisitionNumber: string;
  requisitionLine: number | null;
  uomConversion: number | null;
}

export interface PORecord {
  header: POHeader;
  lines: POLine[];
}

export interface POReceipt {
  domain: string;
  poNumber: string;
  line: number | null;
  receiptDate: string | null;
  quantityReceived: number | null;
  receiver: string;
  site: string;
  vendor: string;
  part: string;
  uom: string;
  packingSlip: string;
}


export interface TRHistReceipt {
  transactionNumber: number | null;
  type: string;
  poNumber: string;
  line: number | null;
  quantityLocation: number | null;
  quantityShort: number | null;
  quantityRequired: number | null;
  price: number | null;
  transactionDate: string | null;
  rowid: string;
}

export interface POLongcharResult {
  ok: boolean;
  message: string;
  xml: string;
  rawOutput: string;
  receiverNumber?: string;
}

export interface OpenPOSearch {
  item?: string;
  vendor?: string;
  buyer?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  poNumber?: string;
  project?: string;
  status?: string;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "yes" || value === 1 || value === "1";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function extractOtherInfoValue(xml: string, fieldName: string): string {
  if (!xml || !fieldName) return "";
  const blocks = xml.match(/<ttOtherInfo>[\s\S]*?<\/ttOtherInfo>/gi) || [];
  for (const block of blocks) {
    if (!block.includes(`<ttField>${fieldName}</ttField>`)) continue;
    const valueMatch = block.match(/<ttValue>([\s\S]*?)<\/ttValue>/i);
    if (valueMatch?.[1] != null) return valueMatch[1].trim();
    if (block.includes("<ttValue/>") || block.includes("<ttValue />")) return "";
  }
  return "";
}

function flattenHeader(row: any): POHeader {
  return {
    poNumber: asString(row.ttpo_nbr),
    domain: asString(row.ttpo_domain),
    vendor: asString(row.ttpo_vend),
    vendorName: asString(row.ttpo_vend_name),
    buyer: asString(row.ttpo_buyer),
    status: asString(row.ttpo_stat),
    type: asString(row.ttpo_type),
    site: asString(row.ttpo_site),
    billTo: asString(row.ttpo_bill),
    shipTo: asString(row.ttpo_ship),
    shipVia: asString(row.ttpo_shipvia),
    currency: asString(row.ttpo_curr),
    creditTerms: asString(row.ttpo_cr_terms),
    remarks: asString(row.ttpo_rmks),
    taxable: asBool(row.ttpo_taxable),
    hasReceipts: asBool(row.ttpo_has_rcpt),
    orderDate: row.ttpo_ord_date || null,
    dueDate: row.ttpo_due_date || null,
    revision: asNumber(row.ttpo_rev),
    estimatedValue: asNumber(row.ttpo_est_value),
    recurring: asBool(row.ttpo_recurr),
    cycle: asString(row.ttpo_cycl),
    effectiveStart: row.ttpo_eff_strt || null,
    effectiveEnd: row.ttpo_eff_to || null,
    exchangeRate: asNumber(row.ttpo_ex_rate),
    exchangeRate2: asNumber(row.ttpo_ex_rate2),
    fob: asString(row.ttpo_fob),
  };
}

function flattenLine(row: any): POLine {
  return {
    poNumber: asString(row.ttpod_nbr),
    domain: asString(row.ttpod_domain),
    line: asNumber(row.ttpod_line),
    description: asString(row.ttpod_desc),
    part: asString(row.ttpod_part),
    vendorPart: asString(row.ttpod_vpart),
    site: asString(row.ttpod_site),
    account: asString(row.ttpod_acct),
    subAccount: asString(row.ttpod_sub),
    costCenter: asString(row.ttpod_cc),
    project: asString(row.ttpod_project),
    status: asString(row.ttpod_status),
    uom: asString(row.ttpod_um),
    stockUom: asString(row.ttpod_stock_um),
    lineType: asString(row.ttpod_type),
    revision: asString(row.ttpod_rev),
    taxable: asBool(row.ttpod_taxable),
    unitCost: asNumber(row.ttpod_pur_cost),
    quantityOrdered: asNumber(row.ttpod_qty_ord),
    quantityReceived: asNumber(row.ttpod_qty_rcvd),
    quantityReturned: asNumber(row.ttpod_qty_rtnd),
    quantityReleased: asNumber(row.ttpod_rel_qty),
    quantityChanged: asNumber(row.ttpod_qty_chg),
    quantityOpen: asNumber(row.ttpod_qty_open),
    dueDate: row.ttpod_due_date || null,
    needDate: row.ttpod_need_date || null,
    periodDate: row.ttpod_per_date || null,
    requisitionNumber: asString(row.ttpod_req_nbr),
    requisitionLine: asNumber(row.ttpod_req_line),
    uomConversion: asNumber(row.ttpod_um_conv),
  };
}

function flattenReceipt(row: any): POReceipt {
  return {
    domain: asString(row.ttprh_domain),
    poNumber: asString(row.ttprh_nbr),
    line: asNumber(row.ttprh_line),
    receiptDate: row.ttprh_rcp_date || null,
    quantityReceived: asNumber(row.ttprh_rcvd),
    receiver: asString(row.ttprh_receiver),
    site: asString(row.ttprh_site),
    vendor: asString(row.ttprh_vend),
    part: asString(row.ttprh_part),
    uom: asString(row.ttprh_um),
    packingSlip: asString(row.ttprh_ps_nbr),
  };
}

function flattenTRHistReceipt(row: any): TRHistReceipt {
  return {
    transactionNumber: asNumber(row.tttr_trnbr),
    type: asString(row.tttr_type),
    poNumber: asString(row.tttr_nbr),
    line: asNumber(row.tttr_line),
    quantityLocation: asNumber(row.tttr_qty_loc),
    quantityShort: asNumber(row.tttr_qty_short),
    quantityRequired: asNumber(row.tttr_qty_req),
    price: asNumber(row.tttr_price),
    transactionDate: row.tttr_date || null,
    rowid: asString(row.tttr_rowid),
  };
}

function groupPO(raw: any): PORecord | null {
  const headerRow = raw.ttpo_mstr?.[0];
  if (!headerRow) return null;
  const nestedLines = Array.isArray(headerRow.ttpod_det) ? headerRow.ttpod_det : [];
  const topLevelLines = Array.isArray(raw.ttpod_det) ? raw.ttpod_det : [];
  const lineRows = nestedLines.length ? nestedLines : topLevelLines;
  return {
    header: flattenHeader(headerRow),
    lines: lineRows.map(flattenLine),
  };
}

function groupOpenPOs(raw: any): PORecord[] {
  const headers: POHeader[] = (raw.ttpo_mstr || []).map(flattenHeader);
  const lines: POLine[] = (raw.ttpod_det || []).map(flattenLine);
  const linesByPo = new Map<string, POLine[]>();
  for (const line of lines) {
    const arr = linesByPo.get(line.poNumber) || [];
    arr.push(line);
    linesByPo.set(line.poNumber, arr);
  }
  return headers.map((header) => ({
    header,
    lines: linesByPo.get(header.poNumber) || [],
  }));
}

function buildOpenPOInput(search: OpenPOSearch | string): string {
  if (typeof search === "string") return search;
  return [
    search.item || "",
    search.vendor || "",
    search.buyer || "",
    search.dueDateFrom || "",
    search.dueDateTo || "",
    search.poNumber || "",
    search.project || "",
    search.status || "",
  ].join(DELIM);
}

export class BePOService {
  static async getInvoicedQty(poNumber: string, line: number, domain: string, userId?: string): Promise<number | null> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetInvoicedQty",
      input: `${poNumber}${DELIM}${line}`,
      domain,
      userId,
      datasetMode: "junk",
    });
    return asNumber(raw.output || raw["return-value"] || "");
  }

  static async getPO(poNumber: string, domain: string, userId?: string): Promise<PORecord | null> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetPODS",
      input: poNumber,
      domain,
      userId,
      datasetMode: "typed",
    });
    return groupPO(raw);
  }

  static async getPOLine(poNumber: string, line: number, domain: string, userId?: string): Promise<POLine | null> {
    const po = await BePOService.getPO(poNumber, domain, userId);
    if (!po) return null;
    return po.lines.find((row) => row.line === line) || null;
  }

  static async getPOReceipts(poNumber: string, domain: string, userId?: string): Promise<POReceipt[]> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetPOReceipts",
      input: poNumber,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttprh_hist || []).map(flattenReceipt);
  }

  static async getTRHistReceipts(startTransaction: number, domain: string, userId?: string): Promise<{ rows: TRHistReceipt[]; nextTransaction: number | null; }> {
    const raw = await DomainMgr.call({
      procedure: "begeneral.p",
      entry: "beGetTRHistReceipts",
      input: String(startTransaction || 0),
      domain,
      userId,
      datasetMode: "typed",
    });

    return {
      rows: (raw.tttr_hist || []).map(flattenTRHistReceipt),
      nextTransaction: asNumber(raw.output),
    };
  }

  static async getPOStatus(poNumber: string, domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetPOStatus",
      input: poNumber,
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.output || raw["return-value"] || "");
  }

  static async getNextPONumber(domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetNextPONbr",
      input: "",
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.output || raw["return-value"] || "");
  }

  static async getNextPONumberCustom(prefix: string, lastNumber: number, domain: string, userId?: string): Promise<{ poNumber: string; lastNumber: number | null; rawValue: string }> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetNextPONbrCustom",
      input: `${prefix}${DELIM}${lastNumber}`,
      domain,
      userId,
      datasetMode: "junk",
    });
    const rawValue = asString(raw.output || raw["return-value"] || "");
    const parts = rawValue.split(DELIM);
    return {
      poNumber: parts[0] || "",
      lastNumber: asNumber(parts[1] || ""),
      rawValue,
    };
  }

  static async getOpenPOByItem(search: OpenPOSearch | string, domain: string, userId?: string): Promise<PORecord[]> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetOpenByItem",
      input: buildOpenPOInput(search),
      domain,
      userId,
      datasetMode: "typed",
    });
    return groupOpenPOs(raw);
  }

  static async getCreatePOStructure(domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beGetCreatePOStructure",
      input: "",
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.longchar || "");
  }

  static async createPO(xml: string, domain: string, userId?: string): Promise<POLongcharResult> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beCreatePO",
      input: "",
      longchar: xml,
      domain,
      userId,
      datasetMode: "junk",
    });
    const rawOutput = asString(raw.output || raw["return-value"] || "");
    const parts = rawOutput.split(DELIM);
    return {
      ok: asBool(parts[0]),
      message: parts[1] || "",
      xml: asString(raw.longchar || ""),
      rawOutput,
    };
  }

  static async receivePO(xml: string, domain: string, userId?: string): Promise<POLongcharResult> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "beReceivePO",
      input: "",
      longchar: xml,
      domain,
      userId,
      datasetMode: "junk",
    });
    const rawOutput = asString(raw.output || raw["return-value"] || "");
    const parts = rawOutput.split(DELIM);
    const resultXml = asString(raw.longchar || "");
    return {
      ok: asBool(parts[0]),
      message: parts[1] || "",
      xml: resultXml,
      rawOutput,
      receiverNumber: extractOtherInfoValue(resultXml, "ReceiverNbr"),
    };
  }

  static async printOpenPO(supplier: string, domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "bepo.p",
      entry: "bePrintOpenPO",
      input: supplier,
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.longchar || "");
  }
}
