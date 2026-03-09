// DataGridDef.ts — Owns data, drives the panel
// Also implements ChildElement — can live inside a tab as a child grid.

import type { Showable } from "./LayoutNode";
import { DataGridRenderer } from "@/components/grid/DataGridRenderer";
import type { ChildElement } from "./ChildElement";
import type { Row, GridMode, FetchParams } from "./types";
import type { FilterTree, FilterCondition } from "@/components/grid/filter/filter-types";
import type { ColumnDef } from "./ColumnDef";
import type { DataSourceDef, ParentBinding } from "./DataSourceDef";

export interface DataGridDefOptions {
  key?: string;
  mode?: GridMode;
  whereClause?: string;
  globalWhereClause?: string;
  pageSize?: number;
  allowedPageSizes?: number[];
  selectFirst?: boolean;
  multiSelect?: boolean;
  saveState?: boolean;
  stateVersion?: number;
  alwaysRetrieve?: string;
  multiDelete?: boolean;
  multiEdit?: boolean;
  multiApprove?: boolean;
  multiSubmit?: boolean;
  multiRetract?: boolean;
  allowSearch?: boolean;
  allowRefresh?: boolean;
  allowExcelExport?: boolean;
  allowAdvancedFilter?: boolean;
  allowColumnChanger?: boolean;
  allowNavigation?: boolean;
  allowPageSizeSelector?: boolean;
  showTitle?: boolean;
  showFooter?: boolean;
  hidden?: boolean;
  onSelect?: (row: Row) => void;
  parentLink?: { parentField: string; myField: string };
}

export interface GridFilterState {
  search: string;
  filterTree: FilterTree;
  columnFilters: Record<string, string>;
}

export class DataGridDef implements ChildElement, Showable {
  readonly type = "grid" as const;

  key: string = "";
  columns: ColumnDef[] = [];

  panel: any = null;   // PanelDef — set via myGrid.panel = myPanel
  onFetch: (() => void) | null = null;  // wired by DataGridRenderer

  private _form: any = null;
  get form(): any { return this._form; }
  set form(f: any) {
    this._form = f;
    if (f && !f.grids.includes(this)) f.grids.push(this);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // dataSource with auto-loading
  // ─────────────────────────────────────────────────────────────────────────────
  // When dataSource is assigned, we immediately fire loadColumns() (fire-and-forget).
  // This ensures parentBindings are loaded BEFORE display() needs them.
  // The load is async but we don't block the constructor — it runs in background.
  // ─────────────────────────────────────────────────────────────────────────────

  private _dataSource?: DataSourceDef;

  get dataSource(): DataSourceDef | undefined {
    return this._dataSource;
  }

  set dataSource(ds: DataSourceDef | undefined) {
    this._dataSource = ds;
    // Fire column/binding loading immediately when dataSource is assigned.
    // This is fire-and-forget — we don't await here.
    // display() will await loadColumns() to ensure it's complete before using bindings.
    ds?.loadColumns();
  }

  /**
   * The active parent binding for this child grid.
   *
   * Set automatically on first display() by matching parent row fields,
   * OR set manually by the page to force a specific relationship.
   */
  parentBinding: ParentBinding | null = null;

  _panelSource?: any;      // PanelDef — drives this child grid when set
  parentLink?: { parentField: string; myField: string; };

  mode: GridMode = "browse";

  // Runtime state
  rows:        Row[] = [];
  selectedRow: Row | null = null;
  totalRows:   number = 0;
  isLoading:   boolean = false;

  // Fetch state
  whereClause:       string = "";
  globalWhereClause: string = "";
  filter?:           FilterTree;
  originalFilter?:   FilterTree;

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLE SOURCE OF TRUTH: All filter state lives on the grid
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Parent binding filter (set by display() for child grids) */
  parentFilter: FilterTree | null = null;
  
  /** UI filter from Advanced Filter modal */
  uiFilter: FilterTree | null = null;
  
  /** Column header filters */
  columnFilters: Record<string, string> = {};
  
  /** Search box text */
  searchText: string = "";
  sort:              string[] = [];
  sortDirection:     ("ASC" | "DESC")[] = [];
  pageSize:          number = 25;
  allowedPageSizes:  number[] = [10, 25, 50, 100];

  // Behaviour flags
  selectFirst:          boolean = false;
  multiSelect:          boolean = false;
  saveState:            boolean = false;
  stateVersion:         number = 1;
  alwaysRetrieve:       string = "";

  // Multi-select bulk operations
  multiDelete:  boolean = false;
  multiEdit:    boolean = false;
  multiApprove: boolean = false;
  multiSubmit:  boolean = false;
  multiRetract: boolean = false;

  // UI feature flags
  allowSearch:           boolean = true;
  allowRefresh:          boolean = true;
  allowExcelExport:      boolean = true;
  allowAdvancedFilter:   boolean = true;
  allowColumnChanger:    boolean = true;
  allowNavigation:       boolean = true;
  allowPageSizeSelector: boolean = true;
  showTitle:             boolean = true;
  showFooter:            boolean = true;

  hidden: boolean = false;

  // Lookup mode
  onSelect?: (row: Row) => void;

  constructor(options?: DataGridDefOptions, form?: any) {
    if (form) this.form = form;
    if (!options) return;
    if (options.key                !== undefined) this.key                = options.key;
    if (options.mode               !== undefined) this.mode               = options.mode;
    if (options.whereClause        !== undefined) this.whereClause        = options.whereClause;
    if (options.globalWhereClause  !== undefined) this.globalWhereClause  = options.globalWhereClause;
    if (options.pageSize           !== undefined) this.pageSize           = options.pageSize;
    if (options.allowedPageSizes   !== undefined) this.allowedPageSizes   = options.allowedPageSizes;
    if (options.selectFirst        !== undefined) this.selectFirst        = options.selectFirst;
    if (options.multiSelect        !== undefined) this.multiSelect        = options.multiSelect;
    if (options.saveState          !== undefined) this.saveState          = options.saveState;
    if (options.stateVersion       !== undefined) this.stateVersion       = options.stateVersion;
    if (options.alwaysRetrieve     !== undefined) this.alwaysRetrieve     = options.alwaysRetrieve;
    if (options.multiDelete        !== undefined) this.multiDelete        = options.multiDelete;
    if (options.multiEdit          !== undefined) this.multiEdit          = options.multiEdit;
    if (options.multiApprove       !== undefined) this.multiApprove       = options.multiApprove;
    if (options.multiSubmit        !== undefined) this.multiSubmit        = options.multiSubmit;
    if (options.multiRetract       !== undefined) this.multiRetract       = options.multiRetract;
    if (options.allowSearch        !== undefined) this.allowSearch        = options.allowSearch;
    if (options.allowRefresh       !== undefined) this.allowRefresh       = options.allowRefresh;
    if (options.allowExcelExport   !== undefined) this.allowExcelExport   = options.allowExcelExport;
    if (options.allowAdvancedFilter !== undefined) this.allowAdvancedFilter = options.allowAdvancedFilter;
    if (options.allowColumnChanger !== undefined) this.allowColumnChanger = options.allowColumnChanger;
    if (options.allowNavigation    !== undefined) this.allowNavigation    = options.allowNavigation;
    if (options.allowPageSizeSelector !== undefined) this.allowPageSizeSelector = options.allowPageSizeSelector;
    if (options.showTitle          !== undefined) this.showTitle          = options.showTitle;
    if (options.showFooter         !== undefined) this.showFooter         = options.showFooter;
    if (options.hidden             !== undefined) this.hidden             = options.hidden;
    if (options.onSelect           !== undefined) this.onSelect           = options.onSelect;
    if (options.parentLink         !== undefined) this.parentLink         = options.parentLink;
  }


  // Semantic commands
  newRecord():           void {} // stub
  saveRecord(row: Row):  void {} // stub
  deleteRecord():        void {} // stub
  copyRecord():          void {} // stub

  // Data loading
  async fetch(params?: Partial<FetchParams>): Promise<void> {
    const api   = this.dataSource?.api   || "";
    const table = this.dataSource?.table || "";
    if (!api || !table) return;
    this.isLoading = true;

    const sort   = params?.sort?.[0]          ?? this.sort[0]          ?? "";
    const dir    = params?.sortDirection?.[0] ?? this.sortDirection[0] ?? "ASC";
    const page   = params?.page     ?? 0;
    const size   = params?.pageSize ?? this.pageSize;
    const search  = params?.search   ?? "";
    const filters = this.getEffectiveFilter();

    const qsObj: Record<string, string> = {
      table:  table,
      offset: String(page * size),
      limit:  String(size),
      sort,
      dir,
    };
    if (search)  qsObj.search  = search;
    if (filters) qsObj.filters = JSON.stringify(filters);

    const qs = new URLSearchParams(qsObj);

    try {
      const res  = await fetch(`${api}?${qs}`);
      const json = await res.json();
      this.rows      = json.rows  ?? [];
      this.totalRows = json.total ?? 0;
      this.onFetch?.();
    } finally {
      this.isLoading = false;
    }
  }
  refreshBrowse(rowid?: string):        Promise<void> { return Promise.resolve(); } // stub
  reset():      void {} // stub
  exportExcel():void {} // stub

  // Selection
  selectRow(rowid: string): void {} // stub
  clearSelection():         void {} // stub
  getSelectedRows():        Row[] { return []; } // stub

  // Column management
  getColumn(key: string): ColumnDef | undefined { return this.columns.find(c => c.key === key); }
  addColumn(col: ColumnDef): this      { return this; } // stub
  removeColumn(key: string): this      { return this; } // stub

  // Filter helpers
  setWhereClause(clause: string): this { return this; } // stub
  setFilter(filter: FilterTree):  this { return this; } // stub

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTIVE FILTER — Merges all filter sources into one
  // ═══════════════════════════════════════════════════════════════════════════

  /** Build column filter tree from columnFilters record */
  private buildColumnFilterTree(): FilterTree | null {
    const entries = Object.entries(this.columnFilters).filter(([, v]) => v);
    if (entries.length === 0) return null;
    const conditions: FilterCondition[] = entries.map(([key, value], idx) => ({
      type: "condition" as const,
      id: `col-filter-${idx}`,
      field: key,
      operator: "contains",
      value: value,
      value2: "",
    }));
    if (conditions.length === 1) return conditions[0] as unknown as FilterTree;
    return { type: "group", id: "col-filter-group", logic: "and", children: conditions } as FilterTree;
  }

  /** Merge two filter trees with AND logic */
  private mergeFilters(a: FilterTree | null, b: FilterTree | null): FilterTree | null {
    if (!a) return b;
    if (!b) return a;
    return { type: "group", id: `merged-${Date.now()}`, logic: "and", children: [a as any, b as any] } as FilterTree;
  }

  /** Get the complete effective filter (all sources merged) */
  getEffectiveFilter(): FilterTree | null {
    let result: FilterTree | null = null;
    result = this.mergeFilters(result, this.parentFilter);
    result = this.mergeFilters(result, this.uiFilter);
    result = this.mergeFilters(result, this.buildColumnFilterTree());
    return result;
  }

  persistState(): void {} // stub

  /** localStorage key for persisting column prefs for this grid. */
  private get _colPrefKey(): string | null {
    const fk = this.form?.formKey;
    const mode = this.mode || "browse";
    if (!fk || !this.key) return null;
    return `isolutions.cols.${fk}.${this.key}.${mode}`;
  }

  /** localStorage key for persisting filter/search state for this grid. */
  private get _filterStateKey(): string | null {
    const fk = this.form?.formKey;
    const mode = this.mode || "browse";
    if (!fk || !this.key) return null;
    return `isolutions.filters.${fk}.${this.key}.${mode}.v${this.stateVersion}`;
  }

  /** Persist current column hidden/width state to localStorage. */
  saveColumnPrefs(): void {
    const k = this._colPrefKey;
    if (!k || typeof localStorage === "undefined") return;
    const prefs = this.columns.map(c => ({ key: c.key, hidden: c.hidden ?? false, width: c.width }));
    localStorage.setItem(k, JSON.stringify(prefs));
  }

  loadFilterState(): GridFilterState | null {
    const k = this._filterStateKey;
    if (!k || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<GridFilterState>;
      return {
        search: typeof parsed.search === "string" ? parsed.search : "",
        filterTree: parsed.filterTree ?? null,
        columnFilters: parsed.columnFilters && typeof parsed.columnFilters === "object"
          ? Object.fromEntries(
              Object.entries(parsed.columnFilters).filter(
                ([key, value]) => key && typeof value === "string" && value.trim() !== ""
              )
            )
          : {},
      };
    } catch {
      return null;
    }
  }

  saveFilterState(state: GridFilterState): void {
    const k = this._filterStateKey;
    if (!k || typeof localStorage === "undefined") return;
    localStorage.setItem(k, JSON.stringify({
      search: state.search ?? "",
      filterTree: state.filterTree ?? null,
      columnFilters: Object.fromEntries(
        Object.entries(state.columnFilters ?? {}).filter(
          ([key, value]) => key && typeof value === "string" && value.trim() !== ""
        )
      ),
    }));
  }

  clearFilterState(): void {
    const k = this._filterStateKey;
    if (!k || typeof localStorage === "undefined") return;
    localStorage.removeItem(k);
  }

  /** Apply saved column prefs (hidden, width, order) from localStorage. */
  private _applyColumnPrefs(): void {
    const k = this._colPrefKey;
    if (!k || typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(k);
    if (!raw) return;
    try {
      const prefs: { key: string; hidden: boolean; width?: number }[] = JSON.parse(raw);
      // Apply hidden + width
      for (const p of prefs) {
        const col = this.columns.find(c => c.key === p.key);
        if (col) {
          col.hidden = p.hidden;
          if (p.width !== undefined) col.width = p.width;
        }
      }
      // Reorder columns to match saved order (unknown cols stay at end)
      const savedKeys = prefs.map(p => p.key);
      const ordered = [
        ...savedKeys.map(k => this.columns.find(c => c.key === k)).filter(Boolean),
        ...this.columns.filter(c => !savedKeys.includes(c.key)),
      ] as typeof this.columns;
      this.columns = ordered;
    } catch {
      // Corrupt prefs — ignore
    }
  }

  async loadColumns(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.loadColumns();
      const existingKeys = new Set(this.columns.map(c => c.key));
      for (const col of this.dataSource.columns) {
        if (!existingKeys.has(col.key)) this.columns.push(col);
      }
    }
    // Apply user's saved column prefs on top of defaults
    this._applyColumnPrefs();
  }

  /**
   * Override in a subclass to provide a custom mobile card layout.
   * Return null to use the default card renderer.
   */
  renderCard(_row: import("./types").Row, _isSelected: boolean): import("react").ReactNode {
    return null;
  }

  render(): import("react").ReactNode {
    const renderKey = `${this.form?.formKey ?? "form"}:${this.key}:${this.mode}`;
    return <DataGridRenderer key={renderKey} grid={this} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // display() — Child Grid Parent Binding
  // ═══════════════════════════════════════════════════════════════════════════════
  //
  // Called when this grid is a child element inside a panel (e.g., RequisitionLinesGrid
  // inside RequisitionEditPanel). The parent panel calls display(row) when a record
  // is selected.
  //
  // This method:
  //   1. Clears data if parentRow is null (no parent selected)
  //   2. Auto-detects the correct parent binding (only on first call)
  //   3. Builds a filter from the binding and parent row values
  //   4. Fetches filtered data for this child grid
  //
  // ═══════════════════════════════════════════════════════════════════════════════

  async display(parentRow: Row | null): Promise<void> {
    // CASE 1: No parent row — clear the grid
    if (!parentRow) {
      this.rows = [];
      this.totalRows = 0;
      this.parentFilter = null;
      this.onFetch?.();
      return;
    }

    // Ensure dataSource columns and bindings are loaded
    if (this.dataSource) {
      await this.dataSource.loadColumns();
    }

    // CASE 2: Check if parent binding is already set (cached or page-forced)
    if (!this.parentBinding) {
      // CASE 3: Auto-detect from dataSource.parentBindings
      const bindings = this.dataSource?.parentBindings ?? {};
      for (const binding of Object.values(bindings)) {
        // Check if ALL parentColumn fields exist in the parent row
        const allFieldsPresent = binding.columns.every(
          col => col.parentColumn in parentRow
        );
        if (allFieldsPresent) {
          // Found a match — cache it for future display() calls
          this.parentBinding = binding;
          break;
        }
      }
    }

    // CASE 4: Build filter from binding
    if (!this.parentBinding) {
      console.warn(`[DataGridDef.display] No parent binding found for grid "${this.key}"`);
      return;
    }

    // Build filter conditions from the binding columns
    const conditions: FilterCondition[] = this.parentBinding.columns.map((col, idx) => ({
      type: "condition" as const,
      id: `parent-bind-${idx}`,
      field: col.childColumn,
      operator: "eq",
      value: String(parentRow[col.parentColumn] ?? ""),
      value2: "",
    }));

    // Wrap in an AND group
    const filterTree: FilterTree = {
      type: "group",
      id: "parent-bind-group",
      logic: "and",
      children: conditions,
    };

    // Store the filter and fetch data
    this.parentFilter = filterTree;
    this.fetch();
  }

  // ChildElement stubs
  show(): import("react").ReactNode { return this.render(); }
  hide(): void {}
  destroy(): void {}
}
