import type { LookupConfig } from "../../LookupTypes";

type GridCol = { key: string; label?: string };

export interface QadGetDataLookupOptions {
  table: string;
  domainField: string;
  valueField: string;
  displayField: string;
  searchWhere: string;
  uniqueWhere: string;
  fieldSet: string;
  searchColumns: string[];
  gridColumns: GridCol[];
  placeholder: string;
  displayTemplate?: string;
}

function quote(value: string): string {
  return value.replace(/'/g, "''");
}

function applyWhere(template: string, domainField: string, domain: string, value: string): string {
  return template
    .replace(/\$DOMAIN/g, `${domainField} eq '${quote(domain)}'`)
    .replace(/&1/g, quote(value));
}

async function postQadData(body: any) {
  const res = await fetch('/api/qad/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error('QAD getData lookup failed:', res.status);
    return { rows: [], total: 0 };
  }
  const data = await res.json().catch(() => ({ rows: [] }));
  return { rows: data.rows || [], total: data.rows?.length || 0 };
}

export function createQadGetDataLookup(options: QadGetDataLookupOptions, overrides?: Partial<LookupConfig>): LookupConfig {
  return {
    valueField: options.valueField,
    displayField: options.displayField,
    displayTemplate: options.displayTemplate,
    searchColumns: options.searchColumns,
    gridColumns: options.gridColumns,
    placeholder: options.placeholder,
    minChars: 1,
    dropdownLimit: 100,
    browsable: false,
    fetchFn: async ({ search, limit, domain }) => {
      const effectiveDomain = String(domain || '').trim().toLowerCase();
      if (!effectiveDomain || !search) return { rows: [], total: 0 };
      return postQadData({
        domain: effectiveDomain,
        table: options.table,
        whereClause: applyWhere(options.searchWhere, options.domainField, effectiveDomain, search),
        fieldSet: options.fieldSet,
        numRecords: limit || 100,
      });
    },
    resolveValueFn: async ({ value, domain }) => {
      const effectiveDomain = String(domain || '').trim().toLowerCase();
      const key = String(value || '').trim();
      if (!effectiveDomain || !key) return null;
      const data = await postQadData({
        domain: effectiveDomain,
        table: options.table,
        whereClause: applyWhere(options.uniqueWhere, options.domainField, effectiveDomain, key),
        fieldSet: options.fieldSet,
        numRecords: 1,
      });
      return data.rows[0] || null;
    },
    ...overrides,
  };
}
