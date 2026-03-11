import type { LookupConfig } from "../LookupTypes";

/**
 * VendorAPI — internal implementation for vendor lookup via QAD/PASOE.
 * Contains fetchFn, renderRow and other non-serializable config.
 * Use VendorLookup (the thin wrapper) for designer-facing usage.
 */
export const VendorAPI = (overrides: Partial<LookupConfig> & { domain: string }): LookupConfig => {
  const { domain, ...rest } = overrides;

  return {
    fetchFn: async ({ search, domain: runtimeDomain }) => {
      if (!search || search.length < 2) return { rows: [], total: 0 };
      const effectiveDomain = runtimeDomain || domain;
      if (!effectiveDomain) return { rows: [], total: 0 };
      const qs = new URLSearchParams({ action: "list", search, domain: effectiveDomain });
      const res = await fetch(`/api/qad/vendors?${qs}`);
      if (!res.ok) {
        console.error("VendorLookup fetch failed:", res.status);
        return { rows: [], total: 0 };
      }
      const data = await res.json();
      return { rows: data.rows || [], total: data.total || 0 };
    },
    resolveValueFn: async ({ value, domain: runtimeDomain }) => {
      const vendorCode = String(value ?? "").trim();
      const effectiveDomain = runtimeDomain || domain;
      if (!vendorCode || !effectiveDomain) return null;
      const qs = new URLSearchParams({ action: "get", code: vendorCode, domain: effectiveDomain });
      const res = await fetch(`/api/qad/vendors?${qs}`);
      if (!res.ok) {
        console.error("VendorLookup resolve failed:", res.status);
        return null;
      }
      return await res.json().catch(() => null);
    },
    valueField: "vendor_code",
    displayField: "vendor_name",
    minChars: 2,
    dropdownLimit: 500,
    browsable: false,
    renderRow: (row: any) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: 13, flexShrink: 0 }}>
            {row.vendor_code}
          </span>
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.vendor_name}
          </span>
        </div>
        {(row.city || row.state) && (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {[row.city, row.state].filter(Boolean).join(", ")}
          </div>
        )}
      </div>
    ),
    gridColumns: [
      { key: "vendor_code", label: "Code" },
      { key: "vendor_name", label: "Name" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
    ],
    onSelect: (record: any) => {
      console.log("VendorLookup selected:", record);
    },
    placeholder: "Search vendors...",
    ...rest,
  };
};
