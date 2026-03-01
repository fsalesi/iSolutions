import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "translations",
  columns: ["locale", "namespace", "key", "value"],
  defaultSort: "key",
  searchColumns: ["namespace", "key", "value"],
  requiredFields: ["locale", "namespace", "key"],
  uniqueErrorMsg: () => "Translation already exists for this locale/namespace/key",
});
