import type { LookupConfig } from "../LookupTypes";

/**
 * Group lookup — preloaded from /api/groups. Active groups only. Single-select by default.
 */
export const GroupLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath: "/api/groups",
  valueField: "group_id",
  displayField: "group_id",
  displayFormat: (r) => r.description ? `${r.group_id} — ${r.description}` : r.group_id,
  dropdownColumns: ["group_id", "description"],
  baseFilters: { is_active: true },
  multiple: false,
  preload: true,
  browsable: false,
  placeholder: "Select group...",
  ...overrides,
});
