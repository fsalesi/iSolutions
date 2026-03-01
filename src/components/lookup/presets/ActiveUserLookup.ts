import type { LookupConfig } from "../LookupTypes";
import { UserLookup } from "./UserLookup";

/** User lookup filtered to active users only. Use for supervisor, delegate, buyer, etc. */
export const ActiveUserLookup = (overrides?: Partial<LookupConfig>): LookupConfig =>
  UserLookup({
    baseFilters: { is_active: true },
    placeholder: "Search active users...",
    ...overrides,
  });
