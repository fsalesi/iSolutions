/**
 * BeOrderService — TypeScript facade over OE beorder.p calls.
 */

import { DomainMgr } from "../DomainMgr";

const DELIM = "";

export interface SalesOrderHeader {
  orderNumber: string;
  domain: string;
  customer: string;
  purchaseOrder: string;
  orderDate: string | null;
  dueDate: string | null;
  requestDate: string | null;
  confirmDate: string | null;
  shipVia: string;
  currency: string;
  site: string;
  shipTo: string;
  commentIndex: number | null;
  rowid: string;
}

export interface SalesOrderLine {
  domain: string;
  orderNumber: string;
  line: number | null;
  part: string;
  description: string;
  itemDescription: string;
  quantityOrdered: number | null;
  uom: string;
  btbPo: string;
  btbPoLine: number | null;
  btbVendor: string;
  listPrice: number | null;
  price: number | null;
  discountPct: number | null;
  dueDate: string | null;
  performDate: string | null;
  requestDate: string | null;
  promiseDate: string | null;
  confirmed: boolean;
  commentIndex: number | null;
  rowid: string;
}

export interface SalesOrderRecord {
  header: SalesOrderHeader;
  lines: SalesOrderLine[];
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "yes" || value === 1 || value === "1";
}

function flattenHeader(row: any): SalesOrderHeader {
  return {
    orderNumber: asString(row.ttso_nbr),
    domain: asString(row.ttso_domain),
    customer: asString(row.ttso_cust),
    purchaseOrder: asString(row.ttso_po),
    orderDate: row.ttso_ord_date || null,
    dueDate: row.ttso_due_date || null,
    requestDate: row.ttso_req_date || null,
    confirmDate: row.ttso_conf_date || null,
    shipVia: asString(row.ttso_shipvia),
    currency: asString(row.ttso_curr),
    site: asString(row.ttso_site),
    shipTo: asString(row.ttso_ship),
    commentIndex: asNumber(row.ttso_cmtindx),
    rowid: asString(row.ttso_rowid),
  };
}

function flattenLine(row: any): SalesOrderLine {
  return {
    domain: asString(row.ttsod_domain),
    orderNumber: asString(row.ttsod_nbr),
    line: asNumber(row.ttsod_line),
    part: asString(row.ttsod_part),
    description: asString(row.ttsod_desc),
    itemDescription: asString(row.ttsod_pt_desc1),
    quantityOrdered: asNumber(row.ttsod_qty_ord),
    uom: asString(row.ttsod_um),
    btbPo: asString(row.ttsod_btb_po),
    btbPoLine: asNumber(row.ttsod_btb_pod_line),
    btbVendor: asString(row.ttsod_btb_vend),
    listPrice: asNumber(row.ttsod_list_pr),
    price: asNumber(row.ttsod_price),
    discountPct: asNumber(row.ttsod_disc_pct),
    dueDate: row.ttsod_due_date || null,
    performDate: row.ttsod_per_date || null,
    requestDate: row.ttsod_req_date || null,
    promiseDate: row.ttsod_promise_date || null,
    confirmed: asBool(row.ttsod_confirm),
    commentIndex: asNumber(row.ttsod_cmtindx),
    rowid: asString(row.ttsod_rowid),
  };
}

function groupOrder(raw: any): SalesOrderRecord | null {
  const headerRow = raw.ttso_mstr?.[0];
  if (!headerRow) return null;
  const nestedLines = Array.isArray(headerRow.ttsod_det) ? headerRow.ttsod_det : [];
  const topLevelLines = Array.isArray(raw.ttsod_det) ? raw.ttsod_det : [];
  const lineRows = nestedLines.length ? nestedLines : topLevelLines;
  return {
    header: flattenHeader(headerRow),
    lines: lineRows.map(flattenLine),
  };
}

function groupOrders(raw: any): SalesOrderRecord[] {
  const headers: SalesOrderHeader[] = (raw.ttso_mstr || []).map(flattenHeader);
  const lines: SalesOrderLine[] = (raw.ttsod_det || []).map(flattenLine);
  const linesByOrder = new Map<string, SalesOrderLine[]>();
  for (const line of lines) {
    const arr = linesByOrder.get(line.orderNumber) || [];
    arr.push(line);
    linesByOrder.set(line.orderNumber, arr);
  }
  return headers.map((header) => ({
    header,
    lines: linesByOrder.get(header.orderNumber) || [],
  }));
}

export class BeOrderService {
  static async getOrder(orderNumber: string, domain: string, userId?: string): Promise<SalesOrderRecord | null> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beGetOrder", input: orderNumber, domain, userId, datasetMode: "typed" });
    return groupOrder(raw);
  }

  static async getOrderByRowid(rowid: string, domain: string, userId?: string): Promise<SalesOrderRecord | null> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beGetOrderByRowid", input: rowid, domain, userId, datasetMode: "typed" });
    return groupOrder(raw);
  }

  static async listOrdersByCustomer(customer: string, domain: string, userId?: string): Promise<SalesOrderRecord[]> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beListOrdersByCustomer", input: customer, domain, userId, datasetMode: "typed" });
    return groupOrders(raw);
  }

  static async listLinesByRowids(rowidsCsv: string, domain: string, userId?: string): Promise<SalesOrderLine[]> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beGetSODByRowids", input: rowidsCsv, domain, userId, datasetMode: "typed" });
    return (raw.ttsod_det || []).map(flattenLine);
  }

  static async clearEMT(orderNumber: string, line: number, domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beClearEMT", input: `${orderNumber}${DELIM}${line}`, domain, userId, datasetMode: "junk" });
    return asString(raw.output || raw["return-value"] || "");
  }

  static async getNextSONumber(domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({ procedure: "beorder.p", entry: "beGetNextSONbr", input: "", domain, userId, datasetMode: "junk" });
    return asString(raw.output || raw["return-value"] || "");
  }
}
