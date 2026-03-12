/**
 * BeGeneralService — TypeScript facade over OE begeneral.p calls.
 */

import { DomainMgr } from "../DomainMgr";

const DELIM = "";

export interface TRHistRecord {
  transactionNumber: number | null;
  type: string;
  number: string;
  line: number | null;
  quantityLocation: number | null;
  quantityShort: number | null;
  quantityRequired: number | null;
  price: number | null;
  date: string | null;
  rowid: string;
}

export interface CreditTermRecord {
  code: string;
  description: string;
  rowid: string;
}

export interface SalesPersonRecord {
  rowid: string;
  address: string;
  sort: string;
  phone: string;
  name: string;
}

export interface TrailerCodeRecord {
  rowid: string;
  code: string;
  description: string;
}

export interface CountryCodeRecord {
  rowid: string;
  code: string;
  country: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function flattenTR(row: any): TRHistRecord {
  return {
    transactionNumber: asNumber(row.tttr_trnbr),
    type: asString(row.tttr_type),
    number: asString(row.tttr_nbr),
    line: asNumber(row.tttr_line),
    quantityLocation: asNumber(row.tttr_qty_loc),
    quantityShort: asNumber(row.tttr_qty_short),
    quantityRequired: asNumber(row.tttr_qty_req),
    price: asNumber(row.tttr_price),
    date: row.tttr_date || null,
    rowid: asString(row.tttr_rowid),
  };
}

function flattenCT(row: any): CreditTermRecord {
  return {
    code: asString(row.ttct_code),
    description: asString(row.ttct_desc),
    rowid: asString(row.ttct_rowid),
  };
}

function flattenSP(row: any): SalesPersonRecord {
  return {
    rowid: asString(row.ttsp_rowid),
    address: asString(row.ttsp_addr),
    sort: asString(row.ttsp_sort),
    phone: asString(row.ttad_phone),
    name: asString(row.ttad_name),
  };
}

function flattenTRL(row: any): TrailerCodeRecord {
  return {
    rowid: asString(row.tttrl_rowid),
    code: asString(row.tttrl_code),
    description: asString(row.tttrl_desc),
  };
}

function flattenCTRY(row: any): CountryCodeRecord {
  return {
    rowid: asString(row.ttctry_rowid),
    code: asString(row.ttctry_ctry_code),
    country: asString(row.ttctry_country),
  };
}

export class BeGeneralService {
  static async getLastTRNbr(domain: string, userId?: string): Promise<number | null> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beGetLastTRNbr", input: "", domain, userId, datasetMode: "junk" });
    return asNumber(raw.output || raw["return-value"] || "");
  }

  static async getLatestTransactionHistory(typeList: string, start: number, lastDate: string, minResults: boolean, domain: string, userId?: string): Promise<{ rows: TRHistRecord[]; nextTransaction: number | null; }> {
    let normalizedDate = lastDate || "";
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDate);
    if (iso) normalizedDate = `${iso[2]}/${iso[3]}/${iso[1]}`;

    const input = [typeList, String(start || 0), normalizedDate, String(!!minResults)].join(DELIM);
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beGetLatestTransactionHistory", input, domain, userId, datasetMode: "typed" });
    return {
      rows: (raw.tttr_hist || []).map(flattenTR),
      nextTransaction: asNumber(raw.output),
    };
  }

  static async getCreditTerms(code: string, domain: string, userId?: string): Promise<CreditTermRecord | null> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beGetCTMstr", input: code, domain, userId, datasetMode: "typed" });
    const row = raw.ttct_mstr?.[0];
    return row ? flattenCT(row) : null;
  }

  static async listCreditTerms(domain: string, userId?: string): Promise<CreditTermRecord[]> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beListCTMstr", input: "", domain, userId, datasetMode: "typed" });
    return (raw.ttct_mstr || []).map(flattenCT);
  }

  static async getSalesPerson(address: string, domain: string, userId?: string): Promise<SalesPersonRecord | null> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beGetSPMstr", input: address, domain, userId, datasetMode: "typed" });
    const row = raw.ttsp_mstr?.[0];
    return row ? flattenSP(row) : null;
  }

  static async listSalesPersons(domain: string, userId?: string): Promise<SalesPersonRecord[]> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beListSPMstr", input: "", domain, userId, datasetMode: "typed" });
    return (raw.ttsp_mstr || []).map(flattenSP);
  }

  static async getTrailerCode(code: string, domain: string, userId?: string): Promise<TrailerCodeRecord | null> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beGetTRLMstr", input: code, domain, userId, datasetMode: "typed" });
    const row = raw.tttrl_mstr?.[0];
    return row ? flattenTRL(row) : null;
  }

  static async listTrailerCodes(domain: string, userId?: string): Promise<TrailerCodeRecord[]> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beListTRLMstr", input: "", domain, userId, datasetMode: "typed" });
    return (raw.tttrl_mstr || []).map(flattenTRL);
  }

  static async listCountryCodes(domain: string, userId?: string): Promise<CountryCodeRecord[]> {
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beListCTRYMstr", input: "", domain, userId, datasetMode: "typed" });
    return (raw.ttctry_mstr || []).map(flattenCTRY);
  }

  static async getWorkDays(site: string, address: string, date: string, days: number, domain: string, userId?: string): Promise<string> {
    let normalizedDate = date || "";
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedDate);
    if (iso) normalizedDate = `${iso[2]}/${iso[3]}/${iso[1]}`;
    const input = [site || "", address || "", normalizedDate, String(days || 0)].join(DELIM);
    const raw = await DomainMgr.call({ procedure: "begeneral.p", entry: "beWorkDaysAhead", input, domain, userId, datasetMode: "junk" });
    return asString(raw.output || raw["return-value"] || "");
  }
}
