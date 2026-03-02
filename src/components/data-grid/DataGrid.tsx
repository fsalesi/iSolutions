"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { useTranslation } from "@/context/TranslationContext";
import { AdvancedSearch, serializeFilters, countConditions, type FilterTree } from "./AdvancedSearch";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── Re-export types for external consumers ──
export type { ColumnDef, SortState, PageResult, FetchPage, ColType } from "./datagrid/types";
import type { ColumnDef, SortState, FetchPage, ColType } from "./datagrid/types";

// ── Sub-modules ──
import { colAlign, formatCellValue } from "./datagrid/grid-utils";
import { useSchemaDiscovery } from "./datagrid/useSchemaDiscovery";
import { useColumnManager, ColumnPicker } from "./datagrid/ColumnManager";
import { useExportPanel, ExportDropdown, type ExportConfig } from "./datagrid/ExportPanel";

interface DataGridProps<T extends { oid: string }> {
  /** Table name for auto-discovering columns via /api/columns. */
  table?: string;
  /** Column overrides merged on top of auto-discovered schema. */
  columns?: ColumnDef<T>[];
  /** Which column keys are visible by default (order matters). If omitted, all columns shown. */
  defaultVisible?: string[];
  fetchPage: FetchPage<T>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  renderCard?: (row: T, isSelected: boolean) => ReactNode;
  defaultSort?: SortState;
  pageSize?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  gridId?: string;
  userId?: string;
  exportConfig?: ExportConfig;
  colTypes?: Record<string, ColType>;
  colScales?: Record<string, number>;
}

export function DataGrid<T extends { oid: string }>({
  table,
  columns: columnOverrides,
  defaultVisible,
  fetchPage,
  selectedId,
  onSelect,
  searchPlaceholder = "Search...",
  renderCard,
  defaultSort,
  pageSize = 50,
  expanded,
  onToggleExpand,
  gridId,
  userId,
  exportConfig,
  colTypes: colTypesProp = {},
  colScales: colScalesProp = {},
}: DataGridProps<T>) {
  const { t, locale } = useTranslation();
  const isMobile = useIsMobile();
  const showExpandBtn = !isMobile && onToggleExpand;
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Sync export keys from grid-prefs load
  useEffect(() => {
    if (!gridId) return;
    const params = new URLSearchParams({ grid: gridId });
    if (userId) params.set("user", userId);
    fetch(`/api/grid-prefs?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.effectiveExport) exp.setExportKeys(data.effectiveExport);
        else if (data.effective) exp.setExportKeys(data.effective);
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
    (offset: number) => `${search}|${appliedFilters}|${sort.field}|${sort.dir}|${offset}`,
    [search, appliedFilters, sort]
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
        const result = await fetchPage({
          offset, limit: pageSize, search,
          sort: sort.field, dir: sort.dir,
          filters: appliedFilters || undefined,
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
    [fetchPage, pageSize, search, sort, appliedFilters, cacheKey]
  );

  // Fresh load on search/sort change
  useEffect(() => {
    prefetchCache.current = null;
    nextOffset.current = 0;
    scrollRef.current?.scrollTo(0, 0);
    loadChunk(0, { replace: true });
  }, [search, sort, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex flex-col overflow-hidden h-full" style={{ background: "var(--bg-surface)" }}>
      {/* ── Toolbar ── */}
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
            <button onClick={() => colMgr.setPickerOpen(p => !p)}
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
                onToggle={colMgr.toggleColumn}
                onMove={colMgr.moveColumn}
                onReset={colMgr.resetToDefault}
                hasUserPref={colMgr.hasUserPref}
              />
            )}
          </div>
        )}

        {exportConfig && !isMobile && (
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
                <div key={row.oid} onClick={() => onSelect(row.oid)}>
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
                      {sort.field === col.key && (<Icon name={sort.dir === "asc" ? "sortAsc" : "sortDesc"} size={12} />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={visibleColumns.length}><EmptyState>Loading...</EmptyState></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={visibleColumns.length}><EmptyState>No results found</EmptyState></td></tr>
              ) : (
                <>
                  {rows.map(row => {
                    const isSelected = selectedId === row.oid;
                    return (
                      <tr key={row.oid} onClick={() => onSelect(row.oid)}
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
                      </tr>
                    );
                  })}
                  {loadingMore && (<tr><td colSpan={visibleColumns.length}><LoadingIndicator /></td></tr>)}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 text-xs flex-shrink-0"
        style={{ background: "var(--bg-surface-alt)", borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
        <span>{loading ? t("crud.loading", "Loading...") : total === 0 ? t("grid.no_records", "No records") : `${rows.length} of ${total}`}</span>
        {hasMore && !loading && <span>↓ scroll for more</span>}
      </div>
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
