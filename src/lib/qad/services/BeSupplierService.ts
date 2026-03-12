/**
 * BeSupplierService — TypeScript facade over OE besupplier.p calls.
 *
 * Mirrors the intent of the old BeSupplier.cls layer while routing all
 * transport through the v2 DomainMgr.
 */

import { DomainMgr } from "../DomainMgr";

export interface VendorSummary {
  vendor_code: string;
  vendor_name: string;
  city: string;
  state: string;
}

export interface VendorDetail {
  vendor_code: string;
  vendor_name: string;
  buyer: string;
  currency: string;
  credit_terms: string;
  ship_via: string;
  default_account: string;
  default_cc: string;
  default_sub: string;
  taxable: boolean;
  active: boolean;
  vendor_type: string;
  company_name: string;
  attn: string;
  line1: string;
  line2: string;
  line3: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  fax: string;
}

function flattenSummary(v: any): VendorSummary {
  const addr = v.ttvdad_mstr?.[0] || {};
  return {
    vendor_code: v.ttvd_addr || "",
    vendor_name: v.ttvd_sort || "",
    city: addr.ttad_city || "",
    state: addr.ttad_state || "",
  };
}

function flattenDetail(v: any): VendorDetail {
  const addr = v.ttvdad_mstr?.[0] || {};
  return {
    vendor_code: v.ttvd_addr || "",
    vendor_name: v.ttvd_sort || "",
    buyer: v.ttvd_buyer || "",
    currency: v.ttvd_curr || "",
    credit_terms: v.ttvd_cr_terms || "",
    ship_via: v.ttvd_shipvia || "",
    default_account: v.ttvd_pur_acct || "",
    default_cc: v.ttvd_pur_cc || "",
    default_sub: v.ttvd_pur_sub || "",
    taxable: v.ttvd_taxable ?? false,
    active: v.ttvd_active ?? true,
    vendor_type: v.ttvd_type || "",
    company_name: addr.ttad_name || "",
    attn: addr.ttad_attn || "",
    line1: addr.ttad_line1 || "",
    line2: addr.ttad_line2 || "",
    line3: addr.ttad_line3 || "",
    city: addr.ttad_city || "",
    state: addr.ttad_state || "",
    zip: addr.ttad_zip || "",
    country: addr.ttad_country || "",
    phone: addr.ttad_phone || "",
    fax: addr.ttad_fax || "",
  };
}

export class BeSupplierService {
  static async listSuppliers(search: string, domain: string, userId?: string): Promise<VendorSummary[]> {
    const raw = await DomainMgr.call({
      procedure: "besupplier.p",
      entry: "beListSuppliers",
      input: search,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttvd_mstr || []).map(flattenSummary);
  }

  static async listSuppliersMatch(search: string, domain: string, userId?: string): Promise<VendorSummary[]> {
    const raw = await DomainMgr.call({
      procedure: "besupplier.p",
      entry: "beListSuppliersMatch",
      input: search,
      domain,
      userId,
      datasetMode: "typed",
    });
    return (raw.ttvd_mstr || []).map(flattenSummary);
  }

  static async getSupplier(code: string, domain: string, userId?: string): Promise<VendorDetail | null> {
    const raw = await DomainMgr.call({
      procedure: "besupplier.p",
      entry: "beGetSupplier",
      input: code,
      domain,
      userId,
      datasetMode: "typed",
    });
    const vendor = raw.ttvd_mstr?.[0];
    return vendor ? flattenDetail(vendor) : null;
  }

  static async getSupplierBySort(name: string, domain: string, userId?: string): Promise<VendorDetail | null> {
    const raw = await DomainMgr.call({
      procedure: "besupplier.p",
      entry: "beGetSupplierBySort",
      input: name,
      domain,
      userId,
      datasetMode: "typed",
    });
    const vendor = raw.ttvd_mstr?.[0];
    return vendor ? flattenDetail(vendor) : null;
  }

  static async getSupplierEmail(code: string, domain: string, userId?: string): Promise<string> {
    const raw = await DomainMgr.call({
      procedure: "besupplier.p",
      entry: "beGetSupplierEmail",
      input: code,
      domain,
      userId,
      datasetMode: "junk",
    });
    return raw?.output || raw?.["return-value"] || raw?.returnValue || raw?.email || "";
  }
}
