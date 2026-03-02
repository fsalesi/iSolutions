import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "settings",
  columns: ["owner", "setting_name", "domain", "form", "value", "help_text",
            "created_at", "created_by", "updated_at", "updated_by"],
  defaultSort: "setting_name",
  searchColumns: ["setting_name", "value", "help_text", "owner", "domain", "form"],
  requiredFields: ["setting_name"],
  transforms: { domain: (v: string) => v?.trim().toUpperCase() },
  uniqueErrorMsg: () => "A setting with this owner, name, domain, and form already exists",
});
