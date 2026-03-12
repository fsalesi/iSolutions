/**
 * BeInventoryService — TypeScript facade over OE beinventory.p calls.
 */

import { DomainMgr } from "../DomainMgr";

export interface InventoryLocationDetail {
  item: string;
  site: string;
  location: string;
  lot: string;
  ref: string;
  quantityOnHand: number | null;
  effectiveDate: string | null;
  expireDate: string | null;
  status: string;
}

export interface InventoryLongcharResult {
  xml: string;
  output: string;
  raw: any;
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function flattenLD(row: any): InventoryLocationDetail {
  return {
    item: asString(row.ttld_part),
    site: asString(row.ttld_site),
    location: asString(row.ttld_loc),
    lot: asString(row.ttld_lot),
    ref: asString(row.ttld_ref),
    quantityOnHand: asNumber(row.ttld_qty_oh),
    effectiveDate: row.ttld_date || null,
    expireDate: row.ttld_expire || null,
    status: asString(row.ttld_status),
  };
}

function joinParts(parts: string[]): string {
  return parts.join("\u0003");
}

export class BeInventoryService {
  static async getUnplannedIssueStructure(domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beGetUnplannedIssueStructure",
      input: "",
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.longchar || "");
  }

  static async unplannedIssue(xml: string, domain: string, userId?: string): Promise<InventoryLongcharResult> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beUnplannedIssue",
      input: "",
      longchar: xml,
      domain,
      userId,
      datasetMode: "junk",
    });
    return { xml: asString(raw.longchar || ""), output: asString(raw.output || raw["return-value"] || ""), raw };
  }

  static async getInventoryTransferStructure(domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beGetInventoryTransferStructure",
      input: "",
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.longchar || "");
  }

  static async transferInventory(xml: string, domain: string, userId?: string): Promise<InventoryLongcharResult> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beTransferInventory",
      input: "",
      longchar: xml,
      domain,
      userId,
      datasetMode: "junk",
    });
    return { xml: asString(raw.longchar || ""), output: asString(raw.output || raw["return-value"] || ""), raw };
  }

  static async getLocInfo(item: string, site: string, location: string, lot: string, ref: string, domain: string, userId?: string): Promise<InventoryLocationDetail | null> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beGetLocInfo",
      input: joinParts([item, site, location, lot, ref]),
      domain,
      userId,
      datasetMode: "typed",
    });
    const row = raw.ttld_det?.[0];
    return row ? flattenLD(row) : null;
  }

  static async getLots(item: string, site: string, lot: string, ref: string, domain: string, userId?: string): Promise<InventoryLocationDetail[]> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beGetLots",
      input: joinParts([item, site, lot, ref]),
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttld_det || []).map(flattenLD);
  }

  static async getLocStatus(site: string, location: string, domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "beinventory.p",
      entry: "beGetLocStatus",
      input: joinParts([site, location]),
      domain,
      userId,
      datasetMode: "junk",
    });
    return asString(raw.output || raw["return-value"] || "");
  }
}
