import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "form_tables",
  columns: ["form_key", "table_name", "is_header", "parent_table", "tab_label", "has_attachments", "sort_order"],
  defaultSort: "sort_order",
  searchColumns: ["table_name", "tab_label"],
  requiredFields: ["form_key", "table_name"],
  uniqueErrorMsg: (body) => `Table "${body.table_name}" already exists in this form`,
});
