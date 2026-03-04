"use client";

import { useState, useCallback, useRef, useEffect, useMemo, useImperativeHandle, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { useTranslation } from "@/context/TranslationContext";
import { AdvancedSearch, serializeFilters, countConditions, type FilterTree } from "./AdvancedSearch";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";

// ── Re-export types for external consumers ──
export type { ColumnDef, SortState, PageResult, FetchPage, ColType } from "./datagrid/types";
import type { ColumnDef, SortState, FetchPage, ColType } from "./datagrid/types";

// ── Sub-modules ──
import { colAlign, formatCellValue } from "./datagrid/grid-utils";
import { useSchemaDiscovery } from "./datagrid/useSchemaDiscovery";
import { useColumnManager, ColumnPicker } from "./datagrid/ColumnManager";
import { useExportPanel, ExportDropdown, type ExportConfig } from "./datagrid/ExportPanel";
import { GridSettingsPanel, type GridSettings } from "./datagrid/GridSettingsPanel";

// ── Publisher interface for useLink / external refresh ──
export interface DataPublisher {
  /** Re-fetch the current page of data. */
  refresh: () => void;
}

interface DataGridProps<T extends { oid: string }> {
  /** Table name for auto-discovering columns via /api/columns. */
  table?: string;
  /** Column overrides merged on top of auto-discovered schema. */
  columns?: ColumnDef<T>[];
  /** Which column keys are visible by default (order matters). If omitted, all columns shown. */
  defaultVisible?: string[];
  /** Custom fetch function. When omitted AND `table` is provided, DataGrid builds its own generic fetch. */
  fetchPage?: FetchPage<T>;
  /** Base API path. Defaults to `/api/{table}`. Only used when DataGrid builds its own fetchPage. */
  apiPath?: string;
  /** Filter conditions for child grids, merged into every fetch as query params. */
  parentFilter?: Record<string, string | number>;
  selectedId: string | null;
  /** Called when user clicks a row. Receives the oid and the full row object. */
  onSelect: (id: string, row: T) => void;
  searchPlaceholder?: string;
  renderCard?: (row: T, isSelected: boolean) => ReactNode;
  defaultSort?: SortState;
  pageSize?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  gridId?: string;
  exportConfig?: ExportConfig;
  colTypes?: Record<string, ColType>;
  colScales?: Record<string, number>;
  /** Column keys that are searched by the search box */
  searchColumns?: string[];
  /** Ref exposing DataPublisher interface (refresh). React 19: ref is a regular prop. */
  ref?: React.Ref<DataPublisher>;
}

export function DataGrid<T extends { oid: string }>({
  table,
  columns: columnOverrides,
  defaultVisible,
  fetchPage: fetchPageProp,
  apiPath: apiPathProp,
  parentFilter,
  selectedId,
  onSelect,
  searchPlaceholder = "Search...",
  renderCard,
  defaultSort,
  pageSize = 50,
  expanded,
  onToggleExpand,
  gridId,
  exportConfig,
  colTypes: colTypesProp = {},
  colScales: colScalesProp = {},
  searchColumns: searchColumnsProp = [],
  ref,
}: DataGridProps<T>) {
  const { t, locale } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useSession();
  const userId = user?.userId;
  const isAdmin = user?.isAdmin ?? false;
  const [hovered, setHovered] = useState(false);
  const [gridSettingsOpen, setGridSettingsOpen] = useState(false);
  const colBtnRef = useRef<HTMLButtonElement>(null);
  const showExpandBtn = !isMobile && onToggleExpand;
  const scrollRef = useRef<HTMLDivElement>(null);
  const refreshTrigger = useRef(0);
  const [, forceRefresh] = useState(0);

  // ── Expose publisher interface (refresh) via ref ──
  useImperativeHandle(ref, () => ({
    refresh: () => {
      refreshTrigger.current++;
      forceRefresh(n => n + 1);
    },
  }));
  // ── Built-in fetchPage when table provided and no custom fetchPage ──
  const resolvedApiPath = apiPathProp || (table ? `/api/${table}` : "");
  const [autoSearchColumns, setAutoSearchColumns] = useState<string[]>([]);
  const searchColumns = searchColumnsProp.length > 0 ? searchColumnsProp : autoSearchColumns;
  const searchableSet = useMemo(() => new Set(searchColumns), [searchColumns]);

  const builtInFetchPage: FetchPage<T> | undefined = useMemo(() => {
    if (fetchPageProp || !resolvedApiPath) return undefined;
    return async ({ offset, limit, search, sort, dir, filters }) => {
      const params = new URLSearchParams({
        offset: String(offset), limit: String(limit), sort, dir,
        ...(search ? { search } : {}),
        ...(filters ? { filters } : {}),
      });
      // Merge parentFilter into query params
      if (parentFilter) {
        for (const [k, v] of Object.entries(parentFilter)) {
          params.set(k, String(v));
        }
      }
      const sep = resolvedApiPath.includes("?") ? "&" : "?";
      const res = await fetch(`${resolvedApiPath}${sep}${params}`);
      return res.json();
    };
  }, [fetchPageProp, resolvedApiPath, parentFilter]);

  const fetchPage = fetchPageProp || builtInFetchPage!;

  // Capture searchColumns from first API response (auto-discovery)
  const searchColsSet = useRef(false);
  const wrappedFetchPage: FetchPage<T> = useMemo(() => {
    return async (params) => {
      const result = await fetchPage(params);
      if (result.searchColumns && !searchColsSet.current) {
        searchColsSet.current = true;
        setAutoSearchColumns(result.searchColumns);
      }
      return result;
    };
  }, [fetchPage]);

  // -- Per-column quick filters --
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeColFilter, setActiveColFilter] = useState<string | null>(null);
  const colFilterInputRef = useRef<HTMLInputElement>(null);
  const activeColFilterCount = useMemo(() => Object.values(columnFilters).filter(Boolean).length, [columnFilters]);

  // ── Schema auto-discovery + merge ──
  const { columns, colTypes, colScales } = useSchemaDiscovery<T>(
    table, columnOverrides, colTypesProp, colScalesProp
  );

  // ── Search (debounced) ──
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterTree>(null);
  const [appliedFilters, setAppliedFilters] = useState<string>("");
  const [advSearchOpen, setAdvSearchOpen] = useState(false);

  // -- Combine advanced filters + column filters into one serialized string --
  const effectiveFilters = useMemo(() => {
    const colConditions = Object.entries(columnFilters)
      .filter(([, v]) => v.trim())
      .map(([field, value]) => ({ type: "condition" as const, field, operator: "contains", value: value.trim() }));
    if (!colConditions.length && !appliedFilters) return "";
    if (!colConditions.length) return appliedFilters;
    const children: any[] = [...colConditions];
    if (appliedFilters) {
      try { children.push(JSON.parse(appliedFilters)); } catch {}
    }
    return JSON.stringify({ type: "group", logic: "and", children });
  }, [columnFilters, appliedFilters]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Saved filters for quick-select dropdown on filter button
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string; filters_json: FilterTree; is_default: boolean }[]>([]);
  const [filterDropOpen, setFilterDropOpen] = useState(false);
  const filterDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridId || !userId) return;
    fetch(`/api/saved-filters?userId=${userId}&gridId=${gridId}`)
      .then(r => r.json()).then(setSavedFilters).catch(() => {});
  }, [gridId, userId]);

  // Refresh saved filters when advanced search closes (user may have saved/deleted)
  useEffect(() => {
    if (advSearchOpen || !gridId || !userId) return;
    fetch(`/api/saved-filters?userId=${userId}&gridId=${gridId}`)
      .then(r => r.json()).then(setSavedFilters).catch(() => {});
  }, [advSearchOpen, gridId, userId]);

  // Auto-focus column filter input when it appears
  useEffect(() => {
    if (activeColFilter && colFilterInputRef.current) {
      setTimeout(() => colFilterInputRef.current?.focus(), 0);
    }
  }, [activeColFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!filterDropOpen) return;
    const h = (e: MouseEvent) => { if (filterDropRef.current && !filterDropRef.current.contains(e.target as Node)) setFilterDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [filterDropOpen]);

  // ── Sort ──
  const [sort, setSort] = useState<SortState>(
    defaultSort || { field: columns[0]?.key || "id", dir: "asc" }
  );

  // ── Column visibility ──
  const colMgr = useColumnManager({ columns, defaultVisible, gridId, userId });
  const visibleColumns = colMgr.visibleKeys
    .map(k => columns.find(c => c.key === k))
    .filter(Boolean) as ColumnDef<T>[];

  // ── Export ──
  const exp = useExportPanel({ gridId, userId });

  const handleSettingsChanged = (settings: GridSettings, allowedKeys: string[] | null, _defaultKeys: string[] | null) => {
    setGridSettings(settings);
    // allowedKeys refresh handled by ColumnManager on next open
  };

  // Grid-level settings loaded from grid_defaults (admin flags)
  const [gridSettings, setGridSettings] = useState<{
    show_search?: boolean;
    show_footer?: boolean;
    show_excel?: boolean;
  }>({});

  // Sync export keys + settings from grid-prefs (single fetch, ColumnManager has its own)
  useEffect(() => {
    if (!gridId) return;
    const params = new URLSearchParams({ grid: gridId });
    if (userId) params.set("user", userId);
    fetch(`/api/grid-prefs?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.effectiveExport) exp.setExportKeys(data.effectiveExport);
        else if (data.effective) exp.setExportKeys(data.effective);
        if (data.settings) setGridSettings(data.settings);
      })
      .catch(() => {});
  }, [gridId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll state ──
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextOffset = useRef(0);
  const prefetchCache = useRef<{ key: string; rows: T[]; total: number } | null>(null);
  const fetchInFlight = useRef<string | null>(null);
  const hasMore = rows.length < total;

  const cacheKey = useCallback(
    (offset: number) => `${search}|${effectiveFilters}|${sort.field}|${sort.dir}|${offset}`,
    [search, effectiveFilters, sort]
  );

  const loadChunk = useCallback(
    async (offset: number, opts: { replace?: boolean; preload?: boolean } = {}) => {
      const { replace = false, preload = false } = opts;
      const key = cacheKey(offset);

      if (!preload && prefetchCache.current?.key === key) {
        const cached = prefetchCache.current;
        prefetchCache.current = null;
        setRows(prev => replace ? cached.rows : [...prev, ...cached.rows]);
        setTotal(cached.total);
        nextOffset.current = offset + cached.rows.length;
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (preload && fetchInFlight.current === key) return;
      fetchInFlight.current = key;

      if (!preload) {
        if (replace) setLoading(true);
        else setLoadingMore(true);
      }

      try {
        const result = await wrappedFetchPage({
          offset, limit: pageSize, search,
          sort: sort.field, dir: sort.dir,
          filters: effectiveFilters || undefined,
        });

        if (preload) {
          prefetchCache.current = { key, rows: result.rows, total: result.total };
        } else {
          setRows(prev => replace ? result.rows : [...prev, ...result.rows]);
          setTotal(result.total);
          nextOffset.current = offset + result.rows.length;
          setLoading(false);
          setLoadingMore(false);
        }
      } catch (err) {
        console.error("DataGrid fetch error:", err);
        if (!preload) { setLoading(false); setLoadingMore(false); }
      } finally {
        if (fetchInFlight.current === key) fetchInFlight.current = null;
      }
    },
    [wrappedFetchPage, pageSize, search, sort, effectiveFilters, cacheKey]
  );

  // Fresh load on search/sort/refresh change
  useEffect(() => {
    prefetchCache.current = null;
    nextOffset.current = 0;
    scrollRef.current?.scrollTo(0, 0);
    loadChunk(0, { replace: true });
  }, [search, sort, effectiveFilters, refreshTrigger.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch next chunk
  useEffect(() => {
    if (loading || loadingMore || rows.length >= total) return;
    const timer = setTimeout(() => loadChunk(nextOffset.current, { preload: true }), 150);
    return () => clearTimeout(timer);
  }, [rows.length, loading, loadingMore, total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll listener
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (loading || loadingMore || rows.length >= total) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        loadChunk(nextOffset.current);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading, loadingMore, rows.length, total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchInput = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(text), 250);
  };

  const handleSort = useCallback((field: string) => {
    setSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }, []);

  return (
    <div className="flex flex-col overflow-hidden h-full" style={{ background: "var(--bg-surface)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Toolbar ── */}
      {gridSettings.show_search !== false && (
      <div className="p-3 flex-shrink-0 flex gap-2 items-center" style={{ borderBottom: "1px solid var(--border-light)" }}>
        <div className="relative flex-1">
          <Icon name="search" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" } as any} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm rounded-lg outline-none transition-all"
            style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--border-focus)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--ring-focus)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* Advanced filter toggle + saved filters dropdown */}
        <div className="relative flex-shrink-0" ref={filterDropRef}>
          <div className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => setAdvSearchOpen(p => !p)}
              className="p-2 transition-colors relative"
              style={{
                background: advSearchOpen || appliedFilters ? "var(--bg-selected)" : "var(--bg-surface-alt)",
                color: appliedFilters ? "var(--accent)" : "var(--text-primary)",
              }}
              title={t("grid.advanced_search", "Advanced search")}
            >
              <Icon name="filter" size={18} />
              {appliedFilters && countConditions(filters) > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] min-w-[16px] h-[16px] flex items-center justify-center rounded-full font-bold"
                  style={{ background: "var(--accent)", color: "#fff" }}>
                  {countConditions(filters)}
                </span>
              )}
            </button>
            {savedFilters.length > 0 && (
              <button onClick={() => setFilterDropOpen(p => !p)}
                className="flex items-center transition-colors px-1 self-stretch"
                style={{
                  background: filterDropOpen ? "var(--bg-selected)" : advSearchOpen || appliedFilters ? "var(--bg-selected)" : "var(--bg-surface-alt)",
                  borderLeft: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <Icon name="chevDown" size={10} />
              </button>
            )}
          </div>
          {filterDropOpen && (
            <div className="absolute top-full right-0 mt-1 z-50 rounded-lg shadow-lg overflow-hidden py-1"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 180 }}>
              {savedFilters.map(sf => (
                <button key={sf.id}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-surface-alt)] flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                  onClick={() => {
                    setFilters(sf.filters_json);
                    setAppliedFilters(serializeFilters(sf.filters_json));
                    setFilterDropOpen(false);
                  }}
                >
                  <span className="truncate flex-1">{sf.name}</span>
                  {sf.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "#fff" }}>default</span>}
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--bg-surface-alt)]"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => { setFilters(null); setAppliedFilters(""); setFilterDropOpen(false); }}
                >
                  {t("grid.clear_filters", "Clear filters")}
                </button>
              </div>
            </div>
          )}
        </div>

        {!isMobile && (
          <div className="relative" ref={colMgr.pickerRef}>
            <button ref={colBtnRef} onClick={() => colMgr.setPickerOpen(p => !p)}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{ background: colMgr.pickerOpen ? "var(--bg-selected)" : "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              title={t("grid.choose_columns", "Choose columns")}
            >
              <Icon name="columns" size={18} />
            </button>
            {colMgr.pickerOpen && (
              <ColumnPicker
                allColumns={columns}
                visibleKeys={colMgr.visibleKeys}
                allowedKeys={colMgr.allowedKeys}
                onToggle={colMgr.toggleColumn}
                onMove={colMgr.moveColumn}
                onReset={colMgr.resetToDefault}
                hasUserPref={colMgr.hasUserPref}
                anchorRef={colBtnRef}
              />
            )}
          </div>
        )}

        {exportConfig && !isMobile && gridSettings.show_excel !== false && (
          <div className="relative" ref={exp.exportRef}>
            <button onClick={() => exp.setExportOpen(p => !p)}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{ background: exp.exportOpen ? "var(--bg-selected)" : "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              title={t("grid.export", "Export to Excel")}
            >
              <Icon name="download" size={18} />
            </button>
            {exp.exportOpen && (
              <ExportDropdown
                columns={columns}
                exportKeys={exp.exportKeys}
                setExportKeys={exp.setExportKeys}
                visibleKeys={colMgr.visibleKeys}
                allowedKeys={colMgr.allowedKeys}
                exportConfig={exportConfig}
                search={search}
                sort={sort}
                gridId={gridId}
                userId={userId}
                onClose={() => exp.setExportOpen(false)}
              />
            )}
          </div>
        )}

        {isAdmin && gridId && (
          <button
            onClick={() => setGridSettingsOpen(true)}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            title="Grid settings"
          >
            <Icon name="settings" size={18} />
          </button>
        )}

        {showExpandBtn && (
          <button onClick={onToggleExpand}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            title={expanded ? t("grid.collapse", "Collapse grid") : t("grid.expand", "Expand grid")}
          >
            <Icon name={expanded ? "collapse" : "expand"} size={18} />
          </button>
        )}
      </div>

      )}
      {/* ── Advanced Search ── */}
      {advSearchOpen && (
        <AdvancedSearch
          columns={columns}
          colTypes={colTypes}
          filters={filters}
          onChange={setFilters}
          onApply={(tree) => {
            setAppliedFilters(serializeFilters(tree !== undefined ? tree : filters));
            setAdvSearchOpen(false);
          }}
          onClose={() => setAdvSearchOpen(false)}
          gridId={gridId}
          userId={userId}
        />
      )}

      {/* ── Content ── */}
      {isMobile ? (
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {loading ? (
            <EmptyState>Loading...</EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState>No results found</EmptyState>
          ) : (
            <>
              {rows.map(row => (
                <div key={row.oid} onClick={() => onSelect(row.oid, row)}>
                  {renderCard ? renderCard(row, selectedId === row.oid)
                    : <DefaultCard row={row} columns={visibleColumns} isSelected={selectedId === row.oid} colTypes={colTypes} colScales={colScales} locale={locale} />}
                </div>
              ))}
              {loadingMore && <LoadingIndicator />}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10" style={{ background: "var(--bg-surface-alt)" }}>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {visibleColumns.map(col => (
                  <th key={col.key}
                    onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                    className="px-3 py-2 text-xs font-medium uppercase tracking-wider select-none"
                    style={{ color: "var(--text-muted)", cursor: col.sortable !== false ? "pointer" : "default", width: col.width, textAlign: colAlign(col.key, colTypes) }}
                  >
                    <div className="flex items-center gap-1" style={{ justifyContent: colAlign(col.key, colTypes) === "right" ? "flex-end" : colAlign(col.key, colTypes) === "center" ? "center" : "flex-start" }}>
                      {col.label}
                      {searchableSet.has(col.key) && (
                        columnFilters[col.key] ? (
                          <span
                            title={`${t("grid.clear_filter", "Clear filter")}: ${columnFilters[col.key]}`}
                            style={{ color: "var(--danger-text)", display: "inline-flex", flexShrink: 0, cursor: "pointer" }}
                            onClick={e => {
                              e.stopPropagation();
                              setColumnFilters(prev => { const next = { ...prev }; delete next[col.key]; return next; });
                              setActiveColFilter(null);
                            }}
                          >
                            <Icon name="x" size={10} />
                          </span>
                        ) : (
                          <span
                            title={t("grid.searchable_column", "Click to filter this column")}
                            style={{ color: "var(--text-muted)", opacity: 0.5, display: "inline-flex", flexShrink: 0, cursor: "pointer" }}
                            onClick={e => {
                              e.stopPropagation();
                              setActiveColFilter(prev => prev === col.key ? null : col.key);
                            }}
                          >
                            <Icon name="filter" size={10} />
                          </span>
                        )
                      )}
                      {sort.field === col.key && (<Icon name={sort.dir === "asc" ? "sortAsc" : "sortDesc"} size={12} />)}
                    </div>
                  </th>
                ))}
                {isAdmin && gridId && gridSettings.show_search === false && (
                  <th
                    className="px-1 py-2 text-xs select-none"
                    style={{ width: 40, opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}
                  >
                    <button
                      onClick={() => setGridSettingsOpen(true)}
                      className="flex items-center justify-center w-full h-full rounded"
                      style={{ color: "var(--text-muted)" }}
                      title="Grid settings"
                    >
                      <Icon name="settings" size={16} />
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            {activeColFilter && (
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  {visibleColumns.map(col => (
                    <th key={col.key} className="px-1 py-1" style={{ fontWeight: "normal" }}>
                      {col.key === activeColFilter ? (
                        <ColumnFilterInput
                          value={columnFilters[col.key] || ""}
                          onChange={val => setColumnFilters(prev => {
                            const next = { ...prev };
                            if (val) next[col.key] = val; else delete next[col.key];
                            return next;
                          })}
                          onClose={() => setActiveColFilter(null)}
                          inputRef={colFilterInputRef}
                          placeholder={col.label || col.key}
                        />
                      ) : columnFilters[col.key] ? (
                        <div className="flex items-center gap-1 px-2 py-1 text-xs rounded"
                          style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                          <span className="truncate flex-1">{columnFilters[col.key]}</span>
                          <button onClick={() => setColumnFilters(prev => {
                            const next = { ...prev }; delete next[col.key]; return next;
                          })} style={{ flexShrink: 0 }}><Icon name="x" size={10} /></button>
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleColumns.length + (isAdmin && gridId && gridSettings.show_search === false ? 1 : 0)}><EmptyState>Loading...</EmptyState></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={visibleColumns.length + (isAdmin && gridId && gridSettings.show_search === false ? 1 : 0)}><EmptyState>No results found</EmptyState></td></tr>
              ) : (
                <>
                  {rows.map(row => {
                    const isSelected = selectedId === row.oid;
                    return (
                      <tr key={row.oid} onClick={() => onSelect(row.oid, row)}
                        className="cursor-pointer transition-colors"
                        style={{ background: isSelected ? "var(--bg-selected)" : "transparent", borderBottom: "1px solid var(--border-light)", borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent" }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        {visibleColumns.map(col => (
                          <td key={col.key} className="px-3 py-2"
                            style={{
                              color: colTypes[col.key] === "boolean" && row[col.key] ? "var(--success-text)" : col.key === visibleColumns[0]?.key ? "var(--text-primary)" : "var(--text-secondary)",
                              fontWeight: colTypes[col.key] === "boolean" && row[col.key] ? 600 : col.key === visibleColumns[0]?.key ? 500 : 400,
                              textAlign: colAlign(col.key, colTypes),
                            }}
                          >
                            {col.render ? col.render(row) : formatCellValue(row[col.key], col.key, colTypes, locale, colScales)}
                          </td>
                        ))}
                        {isAdmin && gridId && gridSettings.show_search === false && <td />}
                      </tr>
                    );
                  })}
                  {loadingMore && (<tr><td colSpan={visibleColumns.length + (isAdmin && gridId && gridSettings.show_search === false ? 1 : 0)}><LoadingIndicator /></td></tr>)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {gridSettings.show_footer !== false && (
      <div className="flex items-center justify-between px-3 py-2 text-xs flex-shrink-0"
        style={{ background: "var(--bg-surface-alt)", borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <span>{loading ? t("crud.loading", "Loading...") : total === 0 ? t("grid.no_records", "No records") : `${rows.length} of ${total}`}</span>
      </div>
      )}
      {isAdmin && gridId && userId && (
        <GridSettingsPanel
          open={gridSettingsOpen}
          onClose={() => setGridSettingsOpen(false)}
          gridId={gridId}
          userId={userId}
          columns={columns}
          onSettingsChanged={handleSettingsChanged}
        />
      )}
    </div>
  );
}

// ── Small helpers ──
function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{children}</div>;
}

function LoadingIndicator() {
  return (
    <div className="py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
      <span className="inline-block animate-spin mr-2" style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
      Loading more...
    </div>
  );
}

function ColumnFilterInput({ value, onChange, onClose, inputRef, placeholder }: {
  value: string; onChange: (v: string) => void; onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>; placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { onChange(draft); onClose(); }
          if (e.key === "Escape") { onClose(); }
        }}
        onBlur={() => { onChange(draft); onClose(); }}
        placeholder={placeholder}
        className="w-full px-2 py-1 text-xs rounded outline-none"
        style={{
          background: "var(--input-bg)", border: "1px solid var(--border-focus)",
          color: "var(--text-primary)", boxShadow: "0 0 0 2px var(--ring-focus)",
        }}
      />
      {draft && (
        <button
          onMouseDown={e => { e.preventDefault(); setDraft(""); onChange(""); onClose(); }}
          style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <Icon name="x" size={12} />
        </button>
      )}
    </div>
  );
}

function DefaultCard<T extends { oid: string }>({
  row, columns, isSelected, colTypes, colScales, locale,
}: { row: T; columns: ColumnDef<T>[]; isSelected: boolean; colTypes: Record<string, ColType>; colScales: Record<string, number>; locale: string }) {
  const visibleCols = columns.filter(c => !c.hideOnMobile);
  const primary = visibleCols[0];
  const secondary = visibleCols.slice(1);

  return (
    <div className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
      style={{ background: isSelected ? "var(--bg-selected)" : "transparent", borderBottom: "1px solid var(--border-light)" }}
    >
      <div className="flex-1 min-w-0">
        {primary && (
          <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {primary.render ? primary.render(row) : formatCellValue(row[primary.key], primary.key, colTypes, locale, colScales)}
          </div>
        )}
        {secondary.length > 0 && (
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {secondary.map((col, i) => (
              <span key={col.key}>{i > 0 && " · "}{col.render ? col.render(row) : formatCellValue(row[col.key], col.key, colTypes, locale, colScales)}</span>
            ))}
          </div>
        )}
      </div>
      <Icon name="chevRight" size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" } as any} />
    </div>
  );
}
