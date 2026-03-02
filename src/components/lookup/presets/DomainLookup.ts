import type { LookupConfig } from "../LookupTypes";

/**
 * Domain lookup — preloaded from ALLOWED_DOMAINS system setting. Single-select by default.
 */
export const DomainLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  fetchFn: async ({ search }) => {
    const res = await fetch("/api/settings/value?name=ALLOWED_DOMAINS");
    const data = await res.json();
    const raw: string = data.value || "";
    let rows = raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((code: string) => ({ code }));
    if (search) {
      const lower = search.toLowerCase();
      rows = rows.filter((r: { code: string }) => r.code.toLowerCase().includes(lower));
    }
    return { rows, total: rows.length };
  },
  valueField: "code",
  displayField: "code",
  multiple: false,
  preload: true,
  browsable: false,
  placeholder: "Select domain...",
  ...overrides,
});
