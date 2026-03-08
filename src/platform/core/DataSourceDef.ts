// DataSourceDef.ts — Single source of truth for data origin + column catalogue.
// Shared by DataGridDef and LookupConfig so both always read from the same place.

import { tx } from "@/lib/i18n/types";
import { ColumnDef, type ColumnDefOptions } from "./ColumnDef";
import type { Row } from "./types";

export interface DataSourceDefOptions {
  api:          string;
  table?:       string;
  baseFilters?: Record<string, string | number | boolean>;
}

/**
 * Describes a parent-child FK relationship.
 * Used by child grids to auto-filter when displayed inside a parent panel.
 */
export interface ParentBinding {
  name: string;           // Usually the parent table name
  parentTable: string;    // Parent table name
  columns: {              // Supports compound keys
    parentColumn: string; // Column on parent table (e.g., "oid")
    childColumn: string;  // Column on this table (e.g., "oid_requisition")
  }[];
}

const SKIP_DEFAULT = new Set(["oid", "created_at", "updated_at", "created_by", "updated_by"]);

const TYPE_MAP: Record<string, ColumnDefOptions["dataType"]> = {
  text:        "string",
  integer:     "number",
  numeric:     "decimal",
  boolean:     "boolean",
  date:        "date",
  timestamptz: "datetime",
  uuid:        "string",
  jsonb:       "string",
};

const RENDERER_MAP: Record<string, import("./types").RendererType> = {
  string:   "text",
  number:   "number",
  decimal:  "currency",
  boolean:  "boolean",
  date:     "dateDisplay",
  datetime: "dateDisplay",
};

const toLabel = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export class DataSourceDef {
  api:         string;
  table:       string | undefined;
  baseFilters: Record<string, string | number | boolean> = {};

  columns: ColumnDef[] = [];

  /**
   * Parent bindings loaded from API (FK relationships).
   * Keyed by parent table name for easy lookup.
   */
  parentBindings: Record<string, ParentBinding> = {};

  private _suppressed = new Set<string>();
  private _loaded     = false;
  private _loading:   Promise<void> | null = null;

  constructor(options: DataSourceDefOptions) {
    this.api   = options.api;
    this.table = options.table ?? undefined;
    if (options.baseFilters) this.baseFilters = options.baseFilters;
  }

  suppress(...keys: string[]): this {
    for (const key of keys) {
      this._suppressed.add(key);
      this.columns = this.columns.filter(c => c.key !== key);
    }
    return this;
  }

  async loadColumns(): Promise<void> {
    if (this._loaded) return;
    if (this._loading) return this._loading;

    this._loading = this._doLoad();
    await this._loading;
  }

  private _defaultLabel(key: string, fallback?: string) {
    const label = fallback ?? toLabel(key);
    if (!this.table) return label;
    return tx(`${this.table}.columns.${key}`, label);
  }

  private async _doLoad(): Promise<void> {
    if (!this.table) return;

    let json: any;
    try {
      const res = await fetch(`/api/${this.table}?columns=1`);
      if (!res.ok) return;
      json = await res.json();
    } catch {
      return;
    }
    if (!json?.columns) return;

    const existingKeys = new Set(this.columns.map(c => c.key));

    for (const col of json.columns) {
      if (this._suppressed.has(col.key)) continue;
      if (existingKeys.has(col.key))     continue;

      const dt = col.dataType ?? "string";
      const column = new ColumnDef({
        key:      col.key,
        label:    this._defaultLabel(col.key, col.label),
        dataType: dt,
        renderer: RENDERER_MAP[dt] ?? "text",
        sortable: true,
        align:    dt === "boolean" ? "center" : "left",
      });
      column.translationScope = this.table;
      this.columns.push(column);
    }

    // Load parent bindings from API response
    if (Array.isArray(json.parentBindings)) {
      for (const binding of json.parentBindings) {
        if (binding.name && binding.parentTable && Array.isArray(binding.columns)) {
          this.parentBindings[binding.name] = binding as ParentBinding;
        }
      }
    }

    this._loaded = true;
  }

  getColumn(key: string): ColumnDef | undefined {
    return this.columns.find(c => c.key === key);
  }

  /**
   * Get a parent binding by name (usually the parent table name).
   * Returns undefined if no binding exists for that parent.
   */
  getParentBinding(name: string): ParentBinding | undefined {
    return this.parentBindings[name];
  }
}
