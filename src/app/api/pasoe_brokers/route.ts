import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "pasoe_brokers",
  columns: ["id", "name", "domain", "connect_string", "proxy_connect", "cacheable",
            "created_at", "created_by", "updated_at", "updated_by"],
  defaultSort: "name",
  searchColumns: ["name", "domain", "connect_string"],
  requiredFields: ["name", "domain"],
  transforms: { domain: (v: string) => v?.trim().toUpperCase() },
  uniqueErrorMsg: () => "Name already exists",
});
