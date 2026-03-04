import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "form_layout",
  columns: ["form_key", "table_name", "layout_type", "layout_key", "parent_key", "sort_order", "properties"],
  defaultSort: "sort_order",
  searchColumns: ["layout_key", "layout_type"],
  requiredFields: ["form_key", "table_name", "layout_type", "layout_key"],
});
