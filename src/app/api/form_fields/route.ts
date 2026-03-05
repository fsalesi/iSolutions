import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "form_fields",
  columns: ["form_key", "table_name", "field_name", "data_type", "max_length", "precision", "scale", "is_nullable", "default_value", "is_indexed", "is_unique", "is_copyable", "case_sensitive", "sort_order", "to_be_deleted", "is_generated", "is_dirty"],
  defaultSort: "sort_order",
  searchColumns: ["field_name"],
  requiredFields: ["form_key", "table_name", "field_name"],
  uniqueErrorMsg: (body) => `Field "${body.field_name}" already exists in table "${body.table_name}"`,
});
