import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "forms",
  columns: ["form_key", "form_name", "description", "has_approvals", "is_generated", "last_generated_at", "needs_generate", "menu_category"],
  defaultSort: "form_key",
  searchColumns: ["form_key", "form_name", "description"],
  requiredFields: ["form_key", "form_name"],
  uniqueErrorMsg: (body) => `Form key "${body.form_key}" already exists`,
});
