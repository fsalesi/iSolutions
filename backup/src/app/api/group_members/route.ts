import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "group_members",
  columns: ["group_id", "member_id", "is_excluded"],
  defaultSort: "member_id",
  searchColumns: ["member_id"],
  requiredFields: ["group_id", "member_id"],
  uniqueErrorMsg: (body) => `Member "${body.member_id}" is already in this group`,
});
