import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "locales",
  columns: ["code", "description", "date_format", "decimal_char", "separator_char", "is_default", "flag_svg"],
  defaultSort: "code",
  searchColumns: ["code", "description"],
  requiredFields: ["code", "description"],
  uniqueErrorMsg: () => "Locale code already exists",
});
