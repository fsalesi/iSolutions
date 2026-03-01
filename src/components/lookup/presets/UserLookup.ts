import type { LookupConfig } from "../LookupTypes";

export const UserLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath: "/api/users",
  valueField: "user_id",
  displayField: "full_name",
  searchColumns: ["user_id", "full_name", "email"],
  gridColumns: [
    { key: "user_id", label: "ID" },
    { key: "full_name", label: "Name" },
    { key: "email", label: "Email" },
  ],
  placeholder: "Search users...",
  ...overrides,
});
