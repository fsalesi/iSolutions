import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "users",
  columns: [
    "user_id", "full_name", "email", "title", "company", "user_type",
    "is_disabled", "expire_date", "last_login", "failed_logins",
    "domains", "phone", "cell_phone", "carrier", "mobile_enabled",
    "street1", "street2", "city", "state", "postal_code", "country",
    "supervisor_id", "delegate_id", "approval_limit",
    "employee_number", "erp_initials", "locale",
    "created_at", "created_by", "updated_at", "updated_by", "oid",
  ],
  colTypes: {
    is_disabled: "boolean",
    mobile_enabled: "boolean",
    failed_logins: "number",
    approval_limit: "number",
    expire_date: "datetime",
    last_login: "datetime",
  },
  defaultSort: "full_name",
  searchColumns: ["user_id", "full_name", "email"],
  requiredFields: ["user_id"],
  uniqueErrorMsg: (body) => `User ID "${body.user_id}" already exists`,
});
