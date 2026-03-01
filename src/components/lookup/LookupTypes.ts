import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { ReactNode } from "react";


/** Dropdown column: plain string for text, or object for special rendering */
export type DropdownColumnType = "flag" | "image" | "badge";
export type DropdownColumn = string | { key: string; type: DropdownColumnType };

/** Helper to extract the key from a DropdownColumn */
export function ddColKey(col: DropdownColumn): string {
  return typeof col === "string" ? col : col.key;
}

/** Helper to get the type (undefined for plain text) */
export function ddColType(col: DropdownColumn): DropdownColumnType | undefined {
  return typeof col === "string" ? undefined : col.type;
}

export interface LookupConfig {
  // --- Data Source (provide ONE of these) ---

  /** Local PG: API path to search. GET with ?search=&limit=&offset= */
  apiPath?: string;

  /** Custom fetch function (overrides apiPath). For QAD or any non-standard source. */
  fetchFn?: (params: {
    search: string;
    limit: number;
    offset: number;
    domain?: string;
  }) => Promise<{ rows: any[]; total: number }>;

  // --- Field Mapping ---

  /** Field to store as the value (e.g. "user_id", "code") */
  valueField: string;

  /** Field to display in the input when a value is selected */
  displayField: string;

  /** Optional: custom display formatter (text only) */
  displayFormat?: (record: any) => string;

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
  gridColumns?: ColumnDef<any>[];

  /** Browse modal title override */
  browseTitle?: string;

  // --- Selection ---

  /** Multi-select mode (default: false) */
  multiple?: boolean;

  /** Callback when a record is selected — use for cascading other fields */
  onSelect?: (record: any) => void;

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
}
