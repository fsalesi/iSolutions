/**
 * BeItemService — TypeScript facade over OE beitem.p calls.
 */

import { DomainMgr } from "../DomainMgr";

export interface ItemSummary {
  item: string;
  description1: string;
  description2: string;
  uom: string;
  status: string;
  site: string;
  revision: string;
  productLine: string;
  restricted: boolean;
  promo: string;
  partType: string;
  group: string;
  planningCode: string;
  price: number | null;
  cumulativeLeadTime: number | null;
}

export interface ProductLineSummary {
  productLine: string;
  description: string;
}

export interface ItemPlanningRecord {
  domain: string;
  item: string;
  site: string;
  planningCode: string;
}

export interface ItemCostRow {
  Vendor: string;
  Item: string;
  Site: string;
  UOM: string;
  Currency: string;
  Qty: number | string;
  UnitCost?: number | string;
  CurrCost?: number | string;
  StockUOM?: string;
  StockQty?: number | string;
}

export interface ItemDetailsRow {
  EffectiveDate: string;
  Item: string;
  SiteId: string;
  InspectionLocationId: string;
  SupplierType: string;
  StandardCost?: number | string;
  Revision?: string;
  LocationId?: string;
  InspectionRequired?: boolean | string;
  PurchaseAccount?: string;
  PurchaseSubAccount?: string;
  PurchaseCostCenter?: string;
  ItemType?: string;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function flattenItem(row: any): ItemSummary {
  return {
    item: row.ttpt_part || "",
    description1: row.ttpt_desc1 || "",
    description2: row.ttpt_desc2 || "",
    uom: row.ttpt_um || "",
    status: row.ttpt_status || "",
    site: row.ttpt_site || "",
    revision: row.ttpt_rev || "",
    productLine: row.ttpt_prod_line || "",
    restricted: Boolean(row.ttpt_restricted),
    promo: row.ttpt_promo || "",
    partType: row.ttpt_part_type || "",
    group: row.ttpt_group || "",
    planningCode: row.ttpt_pm_code || "",
    price: asNumber(row.ttpt_price),
    cumulativeLeadTime: asNumber(row.ttpt_cum_lead),
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

function buildDatasetXml<T extends object>(datasetName: string, tableName: string, rows: T[]): string {
  const rowXml = rows
    .map(row => {
      const fields = Object.entries(row as Record<string, unknown>)
        .map(([key, value]) => `<${key}>${xmlEscape(value)}</${key}>`)
        .join("");
      return `  <${tableName}>${fields}</${tableName}>`;
    })
    .join("\n");

  return `<?xml version="1.0"?>\n<${datasetName} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n${rowXml}\n</${datasetName}>`;
}


async function callTypedDataset(
  procedureEntry: string,
  datasetName: string,
  datasetXml: string,
  domain: string,
  userId?: string,
): Promise<any> {
  return DomainMgr.call({
    procedure: "beitem.p",
    entry: procedureEntry,
    input: "",
    domain,
    userId,
    datasetMode: "typed",
    datasetName,
    datasetXml,
  });
}

export class BeItemService {
  static async getItem(item: string, domain: string, userId?: string): Promise<ItemSummary | null> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beGetItem",
      input: item,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttpt_mstr?.[0];
    return row ? flattenItem(row) : null;
  }

  static async listItems(search: string, domain: string, userId?: string): Promise<ItemSummary[]> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beListItems",
      input: search,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttpt_mstr || []).map(flattenItem);
  }

  static async getItemIQuote(item: string, domain: string, userId?: string): Promise<ItemSummary | null> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beGetItemIQuote",
      input: item,
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttpt_mstr?.[0];
    return row ? flattenItem(row) : null;
  }

  static async listItemsIQuote(search: string, domain: string, userId?: string): Promise<ItemSummary[]> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beListItemsIQuote",
      input: search,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttpt_mstr || []).map(flattenItem);
  }

  static async listProductLines(domain: string, userId?: string): Promise<ProductLineSummary[]> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beListProductLines",
      input: "",
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttpl_mstr || []).map((row: any) => ({
      productLine: row.ttpl_prod_line || "",
      description: row.ttpl_desc || "",
    }));
  }

  static async listItemPlanningRecords(item: string, domain: string, userId?: string): Promise<ItemPlanningRecord[]> {
    const raw = await DomainMgr.call({
      procedure: "beitem.p",
      entry: "beListItemPlanningRecords",
      input: item,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttptp_det || []).map((row: any) => ({
      domain: row.ttptp_domain || "",
      item: row.ttptp_part || "",
      site: row.ttptp_site || "",
      planningCode: row.ttptp_pm_code || "",
    }));
  }

  static async getCost(rows: ItemCostRow[], domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetCost", "dsItemCost", buildDatasetXml("dsItemCost", "ttItemCost", rows), domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getTotalCost(rows: ItemCostRow[], domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetTotalCost", "dsItemCost", buildDatasetXml("dsItemCost", "ttItemCost", rows), domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getCostIQuote(rows: ItemCostRow[], domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetCostIQuote", "dsItemCost", buildDatasetXml("dsItemCost", "ttItemCost", rows), domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getItemDetails(rows: ItemDetailsRow[], domain: string, userId?: string): Promise<{ rows: ItemDetailsRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetItemDetails", "dsItemDetails", buildDatasetXml("dsItemDetails", "ttItemDetails", rows), domain, userId);
    return { rows: raw.ttItemDetails || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getCostXml(datasetXml: string, domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetCost", "dsItemCost", datasetXml, domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getTotalCostXml(datasetXml: string, domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetTotalCost", "dsItemCost", datasetXml, domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getCostIQuoteXml(datasetXml: string, domain: string, userId?: string): Promise<{ rows: ItemCostRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetCostIQuote", "dsItemCost", datasetXml, domain, userId);
    return { rows: raw.ttItemCost || [], output: raw.output || raw["return-value"] || "", raw };
  }

  static async getItemDetailsXml(datasetXml: string, domain: string, userId?: string): Promise<{ rows: ItemDetailsRow[]; output: string; raw: any }> {
    const raw = await callTypedDataset("beGetItemDetails", "dsItemDetails", datasetXml, domain, userId);
    return { rows: raw.ttItemDetails || [], output: raw.output || raw["return-value"] || "", raw };
  }
}
