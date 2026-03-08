/**
 * Vendor Service — QAD supplier lookups via BeSupplier.
 *
 * Mirrors OE-side BeSupplier.cls. Calls PASOE through the proxy,
 * flattens nested dsVD responses into clean typed objects.
 *
 * See /docs/QAD.md → Vendor Service section for full field reference.
 */

import { callQAD } from "./proxy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Flat vendor record for lists / autocomplete */
export interface VendorSummary {
  vendor_code: string;   // ttvd_addr (primary identifier)
  vendor_name: string;   // ttvd_sort
  city: string;
  state: string;
}

/** Full vendor detail for cascading / forms */
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
  // Address
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

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search vendors (starts-with match on sort name).
 * Default search mode; use listSuppliersMatch() for contains.
 */
export async function listSuppliers(
  search: string,
  domain: string
): Promise<VendorSummary[]> {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beListSuppliers",
    input: search,
    domain,
  });
  return (raw.ttvd_mstr || []).map(flattenSummary);
}

/**
 * Search vendors (contains match on sort name).
 * Used when SUPPLIER_SEARCH_MATCHES setting is true.
 */
export async function listSuppliersMatch(
  search: string,
  domain: string
): Promise<VendorSummary[]> {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beListSuppliersMatch",
    input: search,
    domain,
  });
  return (raw.ttvd_mstr || []).map(flattenSummary);
}

/**
 * Get full vendor details by code.
 * Used for cascade: populate phone, address, terms on selection.
 */
export async function getSupplier(
  code: string,
  domain: string
): Promise<VendorDetail | null> {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beGetSupplier",
    input: code,
    domain,
  });
  const v = raw.ttvd_mstr?.[0];
  return v ? flattenDetail(v) : null;
}

/**
 * Get vendor by sort/display name (first match).
 */
export async function getSupplierBySort(
  name: string,
  domain: string
): Promise<VendorDetail | null> {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beGetSupplierBySort",
    input: name,
    domain,
  });
  const v = raw.ttvd_mstr?.[0];
  return v ? flattenDetail(v) : null;
}

/**
 * Get vendor email address.
 */
export async function getSupplierEmail(
  code: string,
  domain: string
): Promise<string> {
  const raw = await callQAD({
    procedure: "besupplier.p",
    entry: "beGetSupplierEmail",
    input: code,
    domain,
  });
  // beGetSupplierEmail returns the email as the return-value
  return raw?.returnValue || raw?.email || "";
}
