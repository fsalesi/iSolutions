// DataSourceDef.ts — Single source of truth for data origin + column catalogue.
// Shared by DataGridDef and LookupConfig so both always read from the same place.

import { ColumnDef, type ColumnDefOptions } from "./ColumnDef";
import type { Row } from "./types";

export interface DataSourceDefOptions {
  api:          string;
  table:        string;
  baseFilters?: Record<string, string | number | boolean>;
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
  table:       string;
  baseFilters: Record<string, string | number | boolean> = {};

  // Full column catalogue — populated lazily by loadColumns()
  columns: ColumnDef[] = [];

  private _suppressed = new Set<string>();
  private _loaded     = false;
  private _loading:   Promise<void> | null = null;

  constructor(options: DataSourceDefOptions) {
    this.api   = options.api;
    this.table = options.table;
    if (options.baseFilters) this.baseFilters = options.baseFilters;
  }

  /** Permanently hide a column from all consumers (grid, lookup, browse modal). */
  suppress(key: string): this {
    this._suppressed.add(key);
    // Also remove if already in catalogue
    this.columns = this.columns.filter(c => c.key !== key);
    return this;
  }

  /** Fetch column catalogue from /api/table_schema once. Safe to call from multiple consumers. */
  async loadColumns(): Promise<void> {
    if (this._loaded) return;
    // If already in-flight, wait for the same promise
    if (this._loading) return this._loading;

    this._loading = this._doLoad();
    await this._loading;
  }

  private async _doLoad(): Promise<void> {
    if (!this.table) return;

    let json: any;
    try {
      const res = await fetch(`/api/table_schema?tables=${this.table}`);
      if (!res.ok) return;
      json = await res.json();
    } catch {
      return;
    }
    if (!json?.rows) return;

    const existingKeys = new Set(this.columns.map(c => c.key));

    for (const row of json.rows) {
      if (row.table_name !== this.table)      continue;
      if (SKIP_DEFAULT.has(row.field_name))   continue;
      if (this._suppressed.has(row.field_name)) continue;
      if (existingKeys.has(row.field_name))   continue;

      const dt = TYPE_MAP[row.data_type] ?? "string";
      this.columns.push(new ColumnDef({
        key:      row.field_name,
        label:    toLabel(row.field_name),
        dataType: dt,
        renderer: RENDERER_MAP[dt] ?? "text",
        sortable: true,
        align:    row.data_type === "boolean" ? "center" : "left",
      }));
    }

    this._loaded = true;
  }

  /** Look up a single column from the catalogue by key. */
  getColumn(key: string): ColumnDef | undefined {
    return this.columns.find(c => c.key === key);
  }
}
