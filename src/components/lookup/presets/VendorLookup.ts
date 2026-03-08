import type { LookupConfig } from "../LookupTypes";
import { VendorAPI } from "./VendorAPI";

/**
 * VendorLookup — serializable thin wrapper over VendorAPI.
 * Used by the Form designer. Serializable overrides (placeholder, multiple, etc.)
 * are stored in form_layout properties JSONB and passed through at render time.
 * The fetchFn/renderRow implementation lives in VendorAPI.
 */
export const VendorLookup = (overrides: Partial<LookupConfig> & { domain: string }): LookupConfig =>
  VendorAPI({
    placeholder: "Search vendors...",
    ...overrides,
  });
