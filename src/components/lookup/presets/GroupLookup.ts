import type { LookupConfig } from "../LookupTypes";

export const GroupLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath: "/api/groups",
  valueField: "group_id",
  displayField: "group_id",
  displayTemplate: "{group_id} - {description}",
  dropdownColumns: ["group_id", "description"],
  multiple: false,
  preload: true,
  browsable: false,
  placeholder: "Select group...",
  ...overrides,
});

/** Filtered to active groups only. */
export const ActiveGroupLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  GroupLookup({ baseFilters: { is_active: true }, ...overrides });
