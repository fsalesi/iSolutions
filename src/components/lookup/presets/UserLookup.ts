import type { LookupConfig } from "../LookupTypes";
import { UserDataSource, ActiveUserDataSource } from "@/page-defs/users/UserDataSource";

export const UserLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  dataSource:     new UserDataSource(),
  valueField:     "user_id",
  displayField:   "full_name",
  searchColumns:  ["user_id", "full_name", "email"],
  gridColumns: [
    { key: "user_id",   label: "ID" },
    { key: "full_name", label: "Name" },
    { key: "email",     label: "Email" },
  ],
  placeholder: "Search users...",
  ...overrides,
});

/** Filtered to active users only. Use for supervisor, delegate, buyer fields. */
export const ActiveUserLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  dataSource:     new ActiveUserDataSource(),
  valueField:     "user_id",
  displayField:   "full_name",
  searchColumns:  ["user_id", "full_name", "email"],
  gridColumns: [
    { key: "user_id",   label: "ID" },
    { key: "full_name", label: "Name" },
    { key: "email",     label: "Email" },
  ],
  placeholder: "Search active users...",
  ...overrides,
});
