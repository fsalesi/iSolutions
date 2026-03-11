import type { DataSourceDef } from "@/platform/core/DataSourceDef";
import type { ReactNode } from "react";


/** Dropdown column: plain string for text, or object for special rendering */
export type DropdownColumnType = "flag" | "image" | "badge";
export type DropdownColumn = string | { key: string; type: DropdownColumnType };

/** Helper to extract the key from a DropdownColumn */
export function ddColKey(col: DropdownColumn | undefined | null): string {
  if (!col) return "";
  return typeof col === "string" ? col : String(col.key ?? "").trim();
}

/** Helper to get the type (undefined for plain text) */
export function ddColType(col: DropdownColumn | undefined | null): DropdownColumnType | undefined {
  if (!col || typeof col === "string") return undefined;
  return col.type;
}

export type LookupResolveReason = "select" | "hydrate" | "clear";

export interface LookupConfig {
  // --- Data Source (provide ONE of these) ---

  /** Local PG: API path to search. GET with ?search=&limit=&offset= */
  apiPath?: string;

  /** DataSourceDef — preferred over apiPath. Shared with the grid for single fetch. */
  dataSource?: DataSourceDef;

  /** Custom fetch function (overrides apiPath). For QAD or any non-standard source. */
  fetchFn?: (params: {
    search: string;
    limit: number;
    offset: number;
    domain?: string;
  }) => Promise<{ rows: any[]; total: number }>;

  /** Resolve one record by exact stored value for initial hydration. */
  resolveValueFn?: (params: {
    value: any;
    domain?: string;
  }) => Promise<any | null>;

  // --- Field Mapping ---

  /** Field to store as the value (e.g. "user_id", "code") */
  valueField: string;

  /** Field to display in the input when a value is selected */
  displayField: string;

  /** Optional: custom display formatter (text only) */
  displayFormat?: (record: any) => string;

  /** Optional: template string for display, e.g. "{group_id} - {description}". Serializable alternative to displayFormat. */
  displayTemplate?: string;

  /** Optional: custom row renderer for dropdown (JSX — shows flag, icon, etc.) */
  renderRow?: (record: any) => ReactNode;

  /** Optional: custom renderer for the selected value display */
  renderValue?: (record: any) => ReactNode;

  /** Fields to search against when typing (default: [valueField, displayField]) */
  searchColumns?: string[];

  // --- Dropdown ---

  /** Max items in dropdown (default: 10) */
  dropdownLimit?: number;

  /** Columns shown in dropdown rows (default: [valueField, displayField]) */
  dropdownColumns?: DropdownColumn[];

  /** Preload all results on mount? (default: false — true for small lists) */
  preload?: boolean;

  // --- Browse Modal ---

  /** Show browse button? (default: true) */
  browsable?: boolean;

  /** Grid columns for the browse modal */
  gridColumns?: Array<{ key: string; label?: string; [k: string]: any }>;

  /** Browse modal title override */
  browseTitle?: string;

  // --- Selection ---

  /** Multi-select mode (default: false) */
  multiple?: boolean;

  /** Render multi-select as a checkbox checklist instead of chips/dropdown */
  checklist?: boolean;

  /** Checklist panel max height in px (default: 260) */
  checklistHeight?: number;

  /** Page size when loading checklist data from API (default: 200) */
  checklistPageSize?: number;

  /** Callback when a record is selected — use for cascading other fields */
  onSelect?: (record: any) => void;

  /** Callback for select/hydrate/clear events */
  onResolve?: (record: any | null, context: { reason: LookupResolveReason; value: any }) => void;

  /** Callback when selection is cleared */
  onClear?: () => void;

  // --- Display ---

  /** Placeholder text when empty */
  /** Filters always applied to every request (e.g. { is_active: true }) */
  baseFilters?: Record<string, string | number | boolean>;
  placeholder?: string;

  /** Read-only mode */
  readOnly?: boolean;

  /** Minimum characters before search fires (default: 0 — search on focus) */
  minChars?: number;

  /** Prepend a wildcard/all option to results (e.g. { value: "*", label: "All Domains" }) */
  allOption?: { value: string; label: string };
}
