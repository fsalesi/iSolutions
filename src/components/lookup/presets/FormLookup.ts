import type { LookupConfig } from "../LookupTypes";
import { FormsDataSource } from "@/platform/pages/forms/FormsDataSource";

export const FormLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  dataSource: new FormsDataSource(),
  valueField: "form_key",
  displayField: "form_name",
  searchColumns: ["form_key", "form_name", "description"],
  gridColumns: [
    { key: "form_key", label: "Key" },
    { key: "form_name", label: "Name" },
    { key: "description", label: "Description" },
  ],
  placeholder: "Select form...",
  ...overrides,
});
