import type { LookupConfig } from "../LookupTypes";

/**
 * Domain lookup — reads the ALLOWED_DOMAINS system setting via /api/settings/list.
 * Returns one row per domain: [{ code: "demo1" }, { code: "demo2" }]
 * Single-select by default, preloaded on mount.
 */
export const DomainLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath:      "/api/settings/list?name=ALLOWED_DOMAINS",
  valueField:   "code",
  displayField: "code",
  multiple:     false,
  preload:      true,
  browsable:    false,
  placeholder:  "Select domain...",
  ...overrides,
});
