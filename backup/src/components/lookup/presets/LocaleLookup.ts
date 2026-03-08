import type { LookupConfig } from "../LookupTypes";

export const LocaleLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath: "/api/locales",
  valueField: "code",
  displayField: "description",
  searchColumns: ["code", "description"],
  dropdownColumns: [{ key: "flag_svg", type: "flag" }, "code", "description"],
  preload: true,
  browsable: false,
  placeholder: "Select locale...",
  ...overrides,
});
