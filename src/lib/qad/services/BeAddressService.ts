/**
 * BeAddressService — TypeScript facade over OE beaddress.p calls.
 */

import { DomainMgr } from "../DomainMgr";

const DELIM = "";

export interface AddressRecord {
  addressNumber: string;
  attention: string;
  attention2: string;
  city: string;
  domain: string;
  fax: string;
  line1: string;
  line2: string;
  line3: string;
  name: string;
  phone: string;
  state: string;
  temporary: boolean;
  type: string;
  zip: string;
  countryCode: string;
  country: string;
  sort: string;
  taxable: boolean;
  rowid: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === "yes" || value === 1 || value === "1";
}

function flattenAddress(row: any): AddressRecord {
  return {
    addressNumber: asString(row.ttad_addr),
    attention: asString(row.ttad_attn),
    attention2: asString(row.ttad_attn2),
    city: asString(row.ttad_city),
    domain: asString(row.ttad_domain),
    fax: asString(row.ttad_fax),
    line1: asString(row.ttad_line1),
    line2: asString(row.ttad_line2),
    line3: asString(row.ttad_line3),
    name: asString(row.ttad_name),
    phone: asString(row.ttad_phone),
    state: asString(row.ttad_state),
    temporary: asBool(row.ttad_temp),
    type: asString(row.ttad_type),
    zip: asString(row.ttad_zip),
    countryCode: asString(row.ttad_ctry),
    country: asString(row.ttad_country),
    sort: asString(row.ttad_sort),
    taxable: asBool(row.ttad_taxable),
    rowid: asString(row.ttad_rowid),
  };
}

export class BeAddressService {
  static async getAddressByRowid(rowid: string, domain: string, userId?: string): Promise<AddressRecord | null> {
    const raw = await DomainMgr.call({ procedure: "beaddress.p", entry: "beGetAddressByRowid", input: rowid, domain, userId, datasetMode: "typed" });
    const row = raw.ttad_mstr?.[0];
    return row ? flattenAddress(row) : null;
  }

  static async getAddress(addressNumber: string, domain: string, userId?: string): Promise<AddressRecord | null> {
    const raw = await DomainMgr.call({ procedure: "beaddress.p", entry: "beGetAddressByNumber", input: addressNumber, domain, userId, datasetMode: "typed" });
    const row = raw.ttad_mstr?.[0];
    return row ? flattenAddress(row) : null;
  }

  static async listAddresses(query: string, exclude = "", domain?: string, userId?: string): Promise<AddressRecord[]> {
    const raw = await DomainMgr.call({ procedure: "beaddress.p", entry: "beListAddresses", input: `${query}${DELIM}${exclude}`, domain: domain || "", userId, datasetMode: "typed" });
    return (raw.ttad_mstr || []).map(flattenAddress);
  }

  static async listAddressesByType(typePrefix: string, domain: string, userId?: string): Promise<AddressRecord[]> {
    const raw = await DomainMgr.call({ procedure: "beaddress.p", entry: "beListAddressesByType", input: typePrefix, domain, userId, datasetMode: "typed" });
    return (raw.ttad_mstr || []).map(flattenAddress);
  }
}
