"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { AdvancedSearch, serializeFilters, countConditions, type FilterTree, type ColType } from "./AdvancedSearch";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── Types ──────────────────────────────────────────────────────────
export type ColumnDef<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
  hideOnMobile?: boolean;
  /** If true, column cannot be hidden */
  locked?: boolean;
};

export type SortState = {
  field: string;
  dir: "asc" | "desc";
};

export type PageResult<T> = {
  rows: T[];
  total: number;
  offset: number;
  limit: number;
};

export type FetchPage<T> = (params: {
  offset: number;
  limit: number;
  search: string;
  sort: string;
  dir: "asc" | "desc";
  filters?: string;
}) => Promise<PageResult<T>>;

interface DataGridProps<T extends { oid: string }> {
  /** All available columns (superset) */
  columns: ColumnDef<T>[];
  /** Which column keys are visible by default (order matters). If omitted, all columns shown. */
  defaultVisible?: string[];
  fetchPage: FetchPage<T>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchPlaceholder?: string;
  renderCard?: (row: T, isSelected: boolean) => ReactNode;
  defaultSort?: SortState;
  pageSize?: number;
  /** Whether the grid is in expanded (full-width) mode. Desktop only. */
  expanded?: boolean;
  /** Toggle expand/collapse. Desktop only. */
  onToggleExpand?: () => void;
  /** Grid identifier for persisting column prefs (e.g. "users"). If omitted, prefs won't persist. */
  gridId?: string;
  /** Current user ID for per-user column prefs. If omitted, only admin defaults apply. */
  userId?: string;
  /** Export config. If provided, shows an export button. */
  exportConfig?: {
    table: string;                    // DB table name (whitelisted server-side)
    searchFields: string[];           // Fields to apply search filter on
    filename?: string;                // Base filename for download
  };
  colTypes?: Record<string, ColType>;
}

export function DataGrid<T extends { oid: string }>({
  columns,
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
  colTypes = {},
}: DataGridProps<T>) {
  const isMobile = useIsMobile();
  const showExpandBtn = !isMobile && onToggleExpand;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Search (debounced)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterTree>(null);
  const [appliedFilters, setAppliedFilters] = useState<string>("");
  const [advSearchOpen, setAdvSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sort
  const [sort, setSort] = useState<SortState>(
    defaultSort || { field: columns[0]?.key || "id", dir: "asc" }
  );

  // ── Column visibility (persisted) ────────────────────────────────
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    () => defaultVisible || columns.map(c => c.key)
  );
  const [adminDefault, setAdminDefault] = useState<string[] | null>(null);
  const [hasUserPref, setHasUserPref] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const prefsLoaded = useRef(false);
  const [exportKeys, setExportKeys] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export picker on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportOpen]);

  // Load persisted column prefs on mount
  useEffect(() => {
    if (!gridId) return;
    const params = new URLSearchParams({ grid: gridId });
    if (userId) params.set("user", userId);

    fetch(`/api/grid-prefs?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.adminDefault) setAdminDefault(data.adminDefault);
        if (data.effective) setVisibleKeys(data.effective);
        if (data.effectiveExport) setExportKeys(data.effectiveExport);
        else if (data.effective) setExportKeys(data.effective);
        setHasUserPref(!!data.userPref);
        prefsLoaded.current = true;
      })
      .catch(() => { prefsLoaded.current = true; });
  }, [gridId, userId]);

  // Auto-save user prefs when columns change (debounced 800ms)
  const savePrefs = useCallback((keys: string[]) => {
    if (!gridId || !userId || !prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/grid-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: gridId, user: userId, visible_keys: keys }),
      }).then(() => setHasUserPref(true)).catch(console.error);
    }, 800);
  }, [gridId, userId]);

  // Columns in display order
  const visibleColumns = visibleKeys
    .map(k => columns.find(c => c.key === k))
    .filter(Boolean) as ColumnDef<T>[];

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  const toggleColumn = (key: string) => {
    setVisibleKeys(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      savePrefs(next);
      return next;
    });
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    setVisibleKeys(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      savePrefs(next);
      return next;
    });
  };

  const resetToDefault = () => {
    const def = adminDefault || defaultVisible || columns.map(c => c.key);
    setVisibleKeys(def);
    // Delete user pref so they get admin default again
    if (gridId && userId) {
      fetch("/api/grid-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: gridId, user: userId, visible_keys: null }),
      }).then(() => setHasUserPref(false)).catch(console.error);
    }
  };

  // ── Export functions ──────────────────────────────────────────────
  const toggleExportCol = (key: string) => {
    setExportKeys(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      // Persist
      if (gridId && userId) {
        fetch("/api/grid-prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grid: gridId, user: userId, export_keys: next }),
        }).catch(console.error);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (!exportConfig || exportKeys.length === 0) return;
    setExporting(true);
    try {
      const exportColumns = exportKeys
        .map(k => columns.find(c => c.key === k))
        .filter(Boolean)
        .map(c => ({ key: c!.key, label: c!.label }));

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: exportConfig.table,
          columns: exportColumns,
          search,
          searchFields: exportConfig.searchFields,
          sort: sort.field,
          dir: sort.dir,
          filename: exportConfig.filename || exportConfig.table,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportConfig.filename || exportConfig.table}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  // ── Infinite scroll state ────────────────────────────────────────
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
      {/* ── Toolbar: search + column picker ── */}
      <div className="p-3 flex-shrink-0 flex gap-2 items-center" style={{ borderBottom: "1px solid var(--border-light)" }}>
        <div className="relative flex-1">
          <Icon name="search" size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" } as any} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm rounded-lg outline-none transition-all"
            style={{
              background: "var(--bg-surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = "var(--border-focus)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--ring-focus)";
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        {/* Advanced filter toggle */}
        <button
          onClick={() => setAdvSearchOpen(p => !p)}
          className="p-2 rounded-lg transition-colors flex-shrink-0 relative"
          style={{
            background: advSearchOpen || appliedFilters ? "var(--bg-selected)" : "var(--bg-surface-alt)",
            border: "1px solid var(--border)",
            color: appliedFilters ? "var(--accent)" : "var(--text-primary)",
          }}
          title="Advanced search"
        >
          <Icon name="filter" size={18} />
          {appliedFilters && countConditions(filters) > 0 && (
            <span className="absolute -top-1 -right-1 text-[10px] min-w-[16px] h-[16px] flex items-center justify-center rounded-full font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}>
              {countConditions(filters)}
            </span>
          )}
        </button>

        {/* Expand / Column picker buttons */}
        {showExpandBtn && (
          <button
            onClick={onToggleExpand}
            className="p-2 rounded-lg transition-colors flex-shrink-0"
            style={{
              background: "var(--bg-surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            title={expanded ? "Collapse grid" : "Expand grid"}
          >
            <Icon name={expanded ? "collapse" : "expand"} size={18} />
          </button>
        )}
        {!isMobile && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setPickerOpen(p => !p)}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{
                background: pickerOpen ? "var(--bg-selected)" : "var(--bg-surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              title="Choose columns"
            >
              <Icon name="columns" size={18} />
            </button>

            {pickerOpen && (
              <ColumnPicker
                allColumns={columns}
                visibleKeys={visibleKeys}
                onToggle={toggleColumn}
                onMove={moveColumn}
                onReset={resetToDefault}
                hasUserPref={hasUserPref}
              />
            )}
          </div>
        )}

        {/* Export button */}
        {exportConfig && !isMobile && (
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(p => !p)}
              className="p-2 rounded-lg transition-colors flex-shrink-0"
              style={{
                background: exportOpen ? "var(--bg-selected)" : "var(--bg-surface-alt)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              title="Export to Excel"
            >
              <Icon name="download" size={18} />
            </button>

            {exportOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 260, maxHeight: 440 }}
              >
                <div className="flex items-center justify-between px-3 py-2 text-xs font-medium"
                  style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
                  <span>Export Columns</span>
                  <div className="flex gap-2">
                    <button onClick={() => setExportKeys(columns.map(c => c.key))}
                      className="text-xs hover:underline" style={{ color: "var(--accent)" }}>All</button>
                    <button onClick={() => setExportKeys([...visibleKeys])}
                      className="text-xs hover:underline" style={{ color: "var(--accent)" }}>Visible</button>
                  </div>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                  {columns.map(col => {
                    const checked = exportKeys.includes(col.key);
                    return (
                      <div key={col.key}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors"
                        style={{ color: checked ? "var(--text-primary)" : "var(--text-muted)" }}
                        onClick={() => toggleExportCol(col.key)}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <Icon name={checked ? "check" : "x"} size={14}
                          style={{ color: checked ? "var(--accent)" : "var(--text-muted)" } as any} />
                        <span className="flex-1 truncate">{col.label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border-light)" }}>
                  <button
                    onClick={handleExport}
                    disabled={exporting || exportKeys.length === 0}
                    className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    style={{
                      background: exportKeys.length === 0 ? "var(--bg-surface-alt)" : "var(--accent)",
                      color: exportKeys.length === 0 ? "var(--text-muted)" : "#fff",
                      cursor: exportKeys.length === 0 ? "not-allowed" : "pointer",
                      opacity: exporting ? 0.7 : 1,
                    }}
                  >
                    <Icon name="download" size={14} />
                    {exporting ? "Exporting..." : `Export ${exportKeys.length} columns`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Advanced Search modal ── */}
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
                    : <DefaultCard row={row} columns={visibleColumns} isSelected={selectedId === row.oid} />}
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
                  <th
                    key={col.key}
                    onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                    className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider select-none"
                    style={{
                      color: "var(--text-muted)",
                      cursor: col.sortable !== false ? "pointer" : "default",
                      width: col.width,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sort.field === col.key && (
                        <Icon name={sort.dir === "asc" ? "sortAsc" : "sortDesc"} size={12} />
                      )}
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
                      <tr
                        key={row.oid}
                        onClick={() => onSelect(row.oid)}
                        className="cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? "var(--bg-selected)" : "transparent",
                          borderBottom: "1px solid var(--border-light)",
                          borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        {visibleColumns.map(col => (
                          <td
                            key={col.key}
                            className="px-3 py-2"
                            style={{
                              color: col.key === visibleColumns[0]?.key ? "var(--text-primary)" : "var(--text-secondary)",
                              fontWeight: col.key === visibleColumns[0]?.key ? 500 : 400,
                            }}
                          >
                            {col.render ? col.render(row) : String(row[col.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {loadingMore && (
                    <tr><td colSpan={visibleColumns.length}><LoadingIndicator /></td></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs flex-shrink-0"
        style={{ background: "var(--bg-surface-alt)", borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        <span>{loading ? "Loading..." : total === 0 ? "No records" : `${rows.length} of ${total}`}</span>
        {hasMore && !loading && <span>↓ scroll for more</span>}
      </div>
    </div>
  );
}

// ── Column Picker Dropdown ─────────────────────────────────────────
function ColumnPicker<T>({
  allColumns, visibleKeys, onToggle, onMove, onReset, hasUserPref,
}: {
  allColumns: ColumnDef<T>[];
  visibleKeys: string[];
  onToggle: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onReset: () => void;
  hasUserPref?: boolean;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        minWidth: 240,
        maxHeight: 400,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}
      >
        <span className="flex items-center gap-1.5">
          Columns
          {hasUserPref && (
            <span className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "var(--bg-selected)", color: "var(--accent)" }}>
              Customized
            </span>
          )}
        </span>
        <button
          onClick={onReset}
          className="text-xs hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Reset to default
        </button>
      </div>

      {/* Column list */}
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {allColumns.map((col) => {
          const visible = visibleKeys.includes(col.key);
          const idx = visibleKeys.indexOf(col.key);
          const isLocked = col.locked;

          return (
            <div
              key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
              style={{
                color: visible ? "var(--text-primary)" : "var(--text-muted)",
                background: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Checkbox */}
              <button
                onClick={() => !isLocked && onToggle(col.key)}
                className="flex-shrink-0"
                style={{ cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.4 : 1 }}
              >
                <Icon name={visible ? "check" : "x"} size={14}
                  style={{ color: visible ? "var(--accent)" : "var(--text-muted)" } as any} />
              </button>

              {/* Label */}
              <span className="flex-1 truncate">{col.label}</span>

              {/* Reorder arrows (only for visible columns) */}
              {visible && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onMove(col.key, -1)}
                    disabled={idx <= 0}
                    className="p-0.5 rounded"
                    style={{ opacity: idx <= 0 ? 0.2 : 0.6, cursor: idx <= 0 ? "default" : "pointer" }}
                  >
                    <Icon name="sortAsc" size={11} />
                  </button>
                  <button
                    onClick={() => onMove(col.key, 1)}
                    disabled={idx >= visibleKeys.length - 1}
                    className="p-0.5 rounded"
                    style={{ opacity: idx >= visibleKeys.length - 1 ? 0.2 : 0.6, cursor: idx >= visibleKeys.length - 1 ? "default" : "pointer" }}
                  >
                    <Icon name="sortDesc" size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────
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
  row, columns, isSelected,
}: { row: T; columns: ColumnDef<T>[]; isSelected: boolean }) {
  const visibleCols = columns.filter(c => !c.hideOnMobile);
  const primary = visibleCols[0];
  const secondary = visibleCols.slice(1);

  return (
    <div
      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
      style={{ background: isSelected ? "var(--bg-selected)" : "transparent", borderBottom: "1px solid var(--border-light)" }}
    >
      <div className="flex-1 min-w-0">
        {primary && (
          <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {primary.render ? primary.render(row) : String(row[primary.key] ?? "")}
          </div>
        )}
        {secondary.length > 0 && (
          <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
            {secondary.map((col, i) => (
              <span key={col.key}>{i > 0 && " · "}{col.render ? col.render(row) : String(row[col.key] ?? "")}</span>
            ))}
          </div>
        )}
      </div>
      <Icon name="chevRight" size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" } as any} />
    </div>
  );
}
