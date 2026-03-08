import { LocaleDataSource } from "@/page-defs/locales/LocaleDataSource";
import type { LookupConfig } from "../LookupTypes";

export const LocaleLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  dataSource:  new LocaleDataSource(),
  valueField: "code",
  displayField:    "description",
  displayTemplate: "{flag_svg} {description}",
  searchColumns: ["code", "description"],
  dropdownColumns: [{ key: "flag_svg", type: "flag" }, "code", "description"],
  preload: true,
  browsable: false,
  placeholder: "Select locale...",
  ...overrides,
});
