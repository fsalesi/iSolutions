import type { LookupConfig } from "../LookupTypes";

type ParentLookupOverrides = Partial<LookupConfig> & {
  __row?: Record<string, unknown>;
};


function inferFormKeyFromDom(): string {
  if (typeof document === "undefined") return "";
  const containers = Array.from(document.querySelectorAll('[data-required][data-field-name="form_key"]'));
  for (const c of containers) {
    const input = c.querySelector('input') as HTMLInputElement | null;
    const val = String(input?.value || "").trim();
    if (val) return val;
  }
  return "";
}

/**
 * ParentTableLookup
 * - Candidate parent tables for Entity Designer table rows.
 * - Prefer scoping by form_key; fallback to oid_forms if needed.
 * - Excludes current table_name to prevent self-parent.
 */
export const ParentTableLookup = (overrides?: ParentLookupOverrides): LookupConfig => {
  const row = (overrides?.__row || {}) as Record<string, unknown>;
  const formKey = String(row.form_key || "").trim() || inferFormKeyFromDom();
  const oidForms = String(row.oid_forms || "").trim();
  const currentTable = String(row.table_name || "").trim();

  const fetchFn: LookupConfig["fetchFn"] = async ({ search, limit, offset }) => {
    const children: Array<{ type: "condition"; field: string; operator: "eq"; value: string | boolean }> = [
      { type: "condition", field: "to_be_deleted", operator: "eq", value: false },
    ];

    if (formKey) {
      children.push({ type: "condition", field: "form_key", operator: "eq", value: formKey });
    } else if (oidForms) {
      children.push({ type: "condition", field: "oid_forms", operator: "eq", value: oidForms });
    }

    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    qs.set("sort", "table_name");
    qs.set("dir", "asc");
    qs.set("filters", JSON.stringify({ type: "group", logic: "and", children }));

    const res = await fetch(`/api/form_tables?${qs.toString()}`);
    if (!res.ok) return { rows: [], total: 0 };

    const data = (await res.json()) as { rows?: Array<Record<string, unknown>> };
    const rows = (Array.isArray(data.rows) ? data.rows : []).filter(
      (r) => String(r.table_name || "") !== currentTable,
    );

    return { rows, total: rows.length };
  };

  const rest = { ...(overrides || {}) } as Record<string, unknown>;
  delete rest.__row;

  return {
    fetchFn,
    valueField: "table_name",
    displayField: "table_name",
    displayTemplate: "{table_name}",
    dropdownColumns: ["table_name", "tab_label"],
    preload: true,
    browsable: false,
    multiple: false,
    placeholder: "(none — header table)",
    ...rest,
  };
};
