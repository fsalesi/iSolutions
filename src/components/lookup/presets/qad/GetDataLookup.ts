import type { LookupConfig } from "../../LookupTypes";

type GridCol = { key: string; label?: string };

export interface QadGetDataLookupOptions {
  dsName?: string;
  table?: string;
  domainField?: string;
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

function applyWhere(template: string, domain: string, value: string, domainField?: string): string {
  const domainToken = domainField ? `${domainField} eq '${quote(domain)}'` : quote(domain);
  return template
    .replace(/\$DOMAIN/g, domainToken)
    .replace(/&1/g, quote(value));
}

async function postQadData(body: any) {
  const res = await fetch('/api/qad/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text().catch(() => null);
    }
    console.error('QAD getData lookup failed', { status: res.status, detail });
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
      const requestBody = {
        domain: effectiveDomain,
        ...(options.table ? { table: options.table } : {}),
        ...(options.dsName ? { dsName: options.dsName } : {}),
        whereClause: applyWhere(options.searchWhere, effectiveDomain, search, options.domainField),
        fieldSet: options.fieldSet,
        numRecords: limit || 100,
      };
      return postQadData(requestBody);
    },
    resolveValueFn: async ({ value, domain }) => {
      const effectiveDomain = String(domain || '').trim().toLowerCase();
      const key = String(value || '').trim();
      if (!effectiveDomain || !key) return null;
      const requestBody = {
        domain: effectiveDomain,
        ...(options.table ? { table: options.table } : {}),
        ...(options.dsName ? { dsName: options.dsName } : {}),
        whereClause: applyWhere(options.uniqueWhere, effectiveDomain, key, options.domainField),
        fieldSet: options.fieldSet,
        numRecords: 1,
      };
      const data = await postQadData(requestBody);
      return data.rows[0] || null;
    },
    ...overrides,
  };
}
