// DataSourceDef.ts — Single source of truth for data origin + column catalogue.
// Shared by DataGridDef and LookupConfig so both always read from the same place.

import { ColumnDef, type ColumnDefOptions } from "./ColumnDef";
import type { Row } from "./types";

export interface DataSourceDefOptions {
  api:          string;
  table?:       string;
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
  table:       string | undefined;
  baseFilters: Record<string, string | number | boolean> = {};

  // Full column catalogue — populated lazily by loadColumns()
  columns: ColumnDef[] = [];

  private _suppressed = new Set<string>();
  private _loaded     = false;
  private _loading:   Promise<void> | null = null;

  constructor(options: DataSourceDefOptions) {
    this.api   = options.api;
    this.table = options.table ?? undefined;
    if (options.baseFilters) this.baseFilters = options.baseFilters;
  }

  /** Permanently hide one or more columns from all consumers (grid, lookup, browse modal). */
  suppress(...keys: string[]): this {
    for (const key of keys) {
      this._suppressed.add(key);
      this.columns = this.columns.filter(c => c.key !== key);
    }
    return this;
  }

  /** Fetch column catalogue from the route's ?columns=1 endpoint once. Safe to call from multiple consumers. */
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
      this.columns.push(new ColumnDef({
        key:      col.key,
        label:    col.label ?? toLabel(col.key),
        dataType: dt,
        renderer: RENDERER_MAP[dt] ?? "text",
        sortable: true,
        align:    dt === "boolean" ? "center" : "left",
      }));
    }

    this._loaded = true;
  }

  /** Look up a single column from the catalogue by key. */
  getColumn(key: string): ColumnDef | undefined {
    return this.columns.find(c => c.key === key);
  }
}
