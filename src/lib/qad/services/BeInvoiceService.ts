/**
 * BeInvoiceService — TypeScript facade over OE beinvoice.p calls.
 */

import { DomainMgr } from "../DomainMgr";

export interface InvoiceHeader {
  rowid: string;
  invoiceNumber: string;
  orderNumber: string;
  domain: string;
  customer: string;
  customerName: string;
  billTo: string;
  billName: string;
  shipTo: string;
  shipName: string;
  orderDate: string | null;
  invoiceDate: string | null;
  shipDate: string | null;
  dueDate: string | null;
  status: string;
  type: string;
  site: string;
  currency: string;
  remarks: string;
  customerPO: string;
  shipVia: string;
  creditTerms: string;
  fob: string;
  taxable: boolean;
  totalAmount: number | null;
  totalLines: number | null;
  taxAmount: number | null;
}

export interface InvoiceLine {
  invoiceNumber: string;
  domain: string;
  line: number | null;
  part: string;
  description: string;
  site: string;
  location: string;
  lot: string;
  ref: string;
  uom: string;
  status: string;
  type: string;
  quantityInvoiced: number | null;
  quantityShipped: number | null;
  quantityOrdered: number | null;
  price: number | null;
  standardCost: number | null;
  productLine: string;
  productLineName: string;
}

export interface InvoiceRecord {
  header: InvoiceHeader;
  lines: InvoiceLine[];
  raw: any;
}

export interface OrderTypeRow {
  site: string;
  location: string;
  part: string;
  lot: string;
  ref: string;
  type: string;
  customer: string;
}

export interface PendingInvoiceResult {
  ok: boolean;
  message: string;
  xml: string;
  rawOutput: string;
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

function flattenHeader(row: any): InvoiceHeader {
  return {
    rowid: asString(row.ttih_rowid),
    invoiceNumber: asString(row.ttih_inv_nbr),
    orderNumber: asString(row.ttih_nbr),
    domain: asString(row.ttih_domain),
    customer: asString(row.ttih_cust),
    customerName: asString(row.ttih_cust_name),
    billTo: asString(row.ttih_bill),
    billName: asString(row.ttih_bill_name),
    shipTo: asString(row.ttih_ship),
    shipName: asString(row.ttih_ship_name),
    orderDate: row.ttih_ord_date || null,
    invoiceDate: row.ttih_inv_date || null,
    shipDate: row.ttih_ship_date || null,
    dueDate: row.ttih_due_date || null,
    status: asString(row.ttih_stat),
    type: asString(row.ttih_type),
    site: asString(row.ttih_site),
    currency: asString(row.ttih_curr),
    remarks: asString(row.ttih_rmks),
    customerPO: asString(row.ttih_po),
    shipVia: asString(row.ttih_shipvia),
    creditTerms: asString(row.ttih_cr_terms),
    fob: asString(row.ttih_fob),
    taxable: asBool(row.ttih_taxable),
    totalAmount: asNumber(row.ttih_total_amt),
    totalLines: asNumber(row.ttih_total_lines),
    taxAmount: asNumber(row.ttih_tax_amount),
  };
}

function flattenLine(row: any): InvoiceLine {
  return {
    invoiceNumber: asString(row.ttidh_inv_nbr),
    domain: asString(row.ttidh_domain),
    line: asNumber(row.ttidh_line),
    part: asString(row.ttidh_part),
    description: asString(row.ttidh_desc),
    site: asString(row.ttidh_site),
    location: asString(row.ttidh_loc),
    lot: asString(row.ttidh_lot),
    ref: asString(row.ttidh_ref),
    uom: asString(row.ttidh_um),
    status: asString(row.ttidh_status),
    type: asString(row.ttidh_type),
    quantityInvoiced: asNumber(row.ttidh_qty_inv),
    quantityShipped: asNumber(row.ttidh_qty_ship),
    quantityOrdered: asNumber(row.ttidh_qty_ord),
    price: asNumber(row.ttidh_price),
    standardCost: asNumber(row.ttidh_std_cost),
    productLine: asString(row.ttidh_prodline),
    productLineName: asString(row.ttidh_prodline_name),
  };
}

function groupInvoice(raw: any): InvoiceRecord | null {
  const headerRow = raw.ttih_hist?.[0];
  if (!headerRow) return null;
  const nestedLines = Array.isArray(headerRow.ttidh_hist) ? headerRow.ttidh_hist : [];
  const topLevelLines = Array.isArray(raw.ttidh_hist) ? raw.ttidh_hist : [];
  const lineRows = nestedLines.length ? nestedLines : topLevelLines;
  return {
    header: flattenHeader(headerRow),
    lines: lineRows.map(flattenLine),
    raw,
  };
}

function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildOrderTypeXml(rows: OrderTypeRow[]): string {
  const rowXml = rows.map((row) => `  <ttOrderType><ttSite>${xmlEscape(row.site)}</ttSite><ttLoc>${xmlEscape(row.location)}</ttLoc><ttPart>${xmlEscape(row.part)}</ttPart><ttLot>${xmlEscape(row.lot)}</ttLot><ttRef>${xmlEscape(row.ref)}</ttRef><ttType>${xmlEscape(row.type)}</ttType><ttCust>${xmlEscape(row.customer)}</ttCust></ttOrderType>`).join("\n");
  return `<?xml version="1.0"?>\n<dsOrderType xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${rowXml}\n</dsOrderType>`;
}

export class BeInvoiceService {
  static async getInvoice(invoiceNumber: string, domain: string, userId?: string): Promise<InvoiceRecord | null> {
    const raw = await DomainMgr.call({
      procedure: "beinvoice.p",
      entry: "beGetInvoice",
      input: invoiceNumber,
      domain,
      userId,
      datasetMode: "typed",
    });
    return groupInvoice(raw);
  }

  static async getInvoiceByRowid(rowid: string, domain: string, userId?: string): Promise<InvoiceRecord | null> {
    const raw = await DomainMgr.call({
      procedure: "beinvoice.p",
      entry: "beGetInvoiceByRowid",
      input: rowid,
      domain,
      userId,
      datasetMode: "typed",
    });
    return groupInvoice(raw);
  }

  static async createPendingInvoice(xml: string, domain: string, userId?: string): Promise<PendingInvoiceResult> {
    const raw = await DomainMgr.call({
      procedure: "beinvoice.p",
      entry: "beCreatePendingInvoice",
      input: "",
      longchar: xml,
      domain,
      userId,
      datasetMode: "junk",
    });
    const rawOutput = asString(raw.output || raw["return-value"] || "");
    const parts = rawOutput.split("");
    return {
      ok: asBool(parts[0]),
      message: parts[1] || "",
      xml: asString(raw.longchar || ""),
      rawOutput,
    };
  }

  static async setOrderTypes(rows: OrderTypeRow[], domain: string, userId?: string): Promise<any> {
    return DomainMgr.call({
      procedure: "beinvoice.p",
      entry: "beSetOrderTypes",
      input: "",
      domain,
      userId,
      datasetMode: "typed",
      datasetName: "dsOrderType",
      datasetXml: buildOrderTypeXml(rows),
    });
  }
}
