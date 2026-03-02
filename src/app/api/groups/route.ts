import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "groups",
  columns: ["group_id", "description", "is_active"],
  defaultSort: "group_id",
  searchColumns: ["group_id", "description"],
  requiredFields: ["group_id"],
  uniqueErrorMsg: (body) => `Group ID "${body.group_id}" already exists`,
});
