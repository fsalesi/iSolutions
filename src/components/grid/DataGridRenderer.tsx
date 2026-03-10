"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@/components/icons/Icon";
import { GridToolbar } from "./GridToolbar";
import { AdvancedSearch } from "./filter/AdvancedSearch";
import type { DataGridDef, GridFilterState } from "@/platform/core/DataGridDef";
import type { ColumnDef } from "@/platform/core/ColumnDef";
import type { Row } from "@/platform/core/types";
import type { FilterTree, ColType } from "./filter/filter-types";
import { countConditions } from "./filter/filter-types";
import type { FilterCondition, FilterGroup } from "./filter/filter-types";
import { CellRenderer } from "./CellRenderer";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";
import { GridDesigner } from "@/platform/core/GridDesigner";
import { DrawerService } from "@/platform/core/DrawerService";

const CHUNK = 50;

interface DataGridRendererProps {
  grid: DataGridDef;
}

// ── Helpers ────────────────────────────────────────────────────────────────

let _uid = 1000;
const uid = () => `cf${_uid++}`;

function buildColFilterTree(
  colFilters: Record<string, string>,
  columns: ColumnDef[]
): FilterTree {
  const conditions: FilterCondition[] = Object.entries(colFilters)
    .filter(([, v]) => v.trim())
    .map(([key, value]) => {
      const col = columns.find(c => c.key === key);
      const isNumeric = col?.dataType === "number" || col?.dataType === "decimal";
      return {
        type: "condition" as const,
        id: uid(),
        field: key,
        operator: isNumeric ? "eq" : "contains",
        value,
        value2: "",
      };
    });
  if (!conditions.length) return null;
  if (conditions.length === 1) return conditions[0] as unknown as FilterTree;
  const group: FilterGroup = { type: "group", id: uid(), logic: "and", children: conditions };
  return group as unknown as FilterTree;
}

function mergeFilters(a: FilterTree, b: FilterTree): FilterTree {
  if (!a) return b;
  if (!b) return a;
  const group: FilterGroup = { type: "group", id: uid(), logic: "and", children: [a as any, b as any] };
  return group as unknown as FilterTree;
}

// ── Component ──────────────────────────────────────────────────────────────

export function DataGridRenderer({ grid }: DataGridRendererProps) {
  const isInfinite = grid.pageSize === 0;
  const isMobile   = useIsMobile();
  const { user } = useSession();
  const isAdmin = user.isAdmin;
  const showInlineAdd = grid.isChildGrid && grid.mode === "browse" && !!grid.panel && !grid.showToolbar;

  // ── Shared state ──────────────────────────────────────────────────────────
  const [columns,       setColumns]       = useState<ColumnDef[]>([]);
  const [rows,          setRows]          = useState<Row[]>([]);
  const [total,         setTotal]         = useState(0);
  const [selectedOid,   setSelectedOid]   = useState<string | null>(null);
  const [search,        setSearch]        = useState("");
  const [sortKey,       setSortKey]       = useState("");
  const [sortDir,       setSortDir]       = useState<"ASC" | "DESC">("ASC");
  const [filterTree,    setFilterTree]    = useState<FilterTree>(null);
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);

  // ── Column filters ────────────────────────────────────────────────────────
  const [columnFilters,   setColumnFilters]   = useState<Record<string, string>>({});
  const [activeColFilter, setActiveColFilter] = useState<string | null>(null);
  const colFilterInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when a column filter is activated
  useEffect(() => {
    if (activeColFilter && colFilterInputRef.current) {
      setTimeout(() => colFilterInputRef.current?.focus(), 0);
    }
  }, [activeColFilter]);

  // ── Paged state ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(0);

  // ── Infinite state ────────────────────────────────────────────────────────
  const [loadingMore,  setLoadingMore]  = useState(false);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const nextOffsetRef  = useRef(0);
  const prefetchRef    = useRef<{ key: string; rows: Row[]; total: number } | null>(null);
  const inFlightRef    = useRef<string | null>(null);
  const hasMore        = rows.length < total;

  const initialized = useRef(false);

  // ── colTypes helper ───────────────────────────────────────────────────────
  const colTypes = (): Record<string, ColType> => {
    const map: Record<string, ColType> = {};
    const lut: Record<string, ColType> = { string: "text", number: "number", decimal: "number", boolean: "boolean", date: "date", datetime: "datetime" };
    for (const c of grid.columns) map[c.key] = lut[c.dataType ?? "string"] ?? "text";
    return map;
  };

  // ── Effective filter (includes parent binding filter for child grids) ──
  // grid.parentFilter is set by display() when this grid is a child inside a parent panel.
  // Infinite scroll mode does its own fetching via fetchChunkDirect, which bypasses
  // grid.parentFilter. So we must always merge grid.parentFilter into the effective filter.
  const buildEft = (uiFilter: FilterTree, colFilters: Record<string, string>, cols: ColumnDef[] = columns) => {
    const uiEft = mergeFilters(uiFilter, buildColFilterTree(colFilters, cols));
    return grid.parentFilter ? mergeFilters(grid.parentFilter, uiEft) : uiEft;
  };

  // ── Paged fetch ───────────────────────────────────────────────────────────
  const doFetch = useCallback(async (opts: {
    page?: number; sort?: string; dir?: "ASC" | "DESC";
    search?: string; filter?: FilterTree;
  } = {}) => {
    setIsLoading(true);
    await grid.fetch({
      page:          opts.page   ?? page,
      pageSize:      grid.pageSize,
      sort:          [opts.sort  ?? sortKey],
      sortDirection: [opts.dir   ?? sortDir],
      search:        opts.search ?? search,
      filter:        opts.filter !== undefined ? opts.filter : (filterTree ?? undefined),
    });
    setRows([...grid.rows]);
    setTotal(grid.totalRows);
    setIsLoading(false);
  }, [grid, page, sortKey, sortDir, search, filterTree]);

  // ── Infinite: direct chunk fetch ──────────────────────────────────────────
  const fetchChunkDirect = useCallback(async (
    offset: number, sv: string, ft: FilterTree, sk: string, sd: string
  ): Promise<{ rows: Row[]; total: number }> => {
    const api   = grid.dataSource?.api   || "";
    const table = grid.dataSource?.table || "";
    if (!api || !table) return { rows: [], total: 0 };
    const qs = new URLSearchParams({
      table,
      offset: String(offset),
      limit:  String(CHUNK),
      sort:   sk,
      dir:    sd.toLowerCase(),
    });
    if (sv) qs.set("search",  sv);
    if (ft)  qs.set("filters", JSON.stringify(ft));
    let data: any;
    try {
      const res = await fetch(`${api}?${qs}`);
      if (!res.ok) return { rows: [], total: 0 };
      data = await res.json();
    } catch {
      return { rows: [], total: 0 };
    }
    return {
      rows:  Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []),
      total: typeof data?.total === "number" ? data.total : 0,
    };
  }, [grid.dataSource]);

  // ── Infinite: cache key ───────────────────────────────────────────────────
  const makeCacheKey = (offset: number, sv: string, ft: FilterTree, sk: string, sd: string) =>
    `${sv}||${JSON.stringify(ft)}||${sk}||${sd}||${offset}`;

  // ── Infinite: load chunk ──────────────────────────────────────────────────
  const loadChunk = useCallback(async (
    offset: number, sv: string, ft: FilterTree, sk: string, sd: string,
    opts: { replace?: boolean; preload?: boolean } = {}
  ) => {
    const { replace = false, preload = false } = opts;
    const key = makeCacheKey(offset, sv, ft, sk, sd);

    if (!preload && prefetchRef.current?.key === key) {
      const cached = prefetchRef.current;
      prefetchRef.current = null;
      setRows(prev => replace ? cached.rows : [...prev, ...cached.rows]);
      setTotal(cached.total);
      nextOffsetRef.current = offset + cached.rows.length;
      setIsLoading(false);
      setLoadingMore(false);
      return;
    }

    if (preload && inFlightRef.current === key) return;
    inFlightRef.current = key;

    if (!preload) replace ? setIsLoading(true) : setLoadingMore(true);

    try {
      const { rows: newRows, total: newTotal } = await fetchChunkDirect(offset, sv, ft, sk, sd);
      if (preload) {
        prefetchRef.current = { key, rows: newRows, total: newTotal };
      } else {
        setRows(prev => replace ? newRows : [...prev, ...newRows]);
        setTotal(newTotal);
        nextOffsetRef.current = offset + newRows.length;
        setIsLoading(false);
        setLoadingMore(false);
      }
    } catch (err) {
      console.error("DataGrid chunk fetch error:", err);
      if (!preload) { setIsLoading(false); setLoadingMore(false); }
    } finally {
      if (inFlightRef.current === key) inFlightRef.current = null;
    }
  }, [fetchChunkDirect]);

  // ── Stable refs (avoid stale closures in scroll/prefetch effects) ─────────
  const stateRef = useRef({ search, filterTree, sortKey, sortDir, columnFilters });
  useEffect(() => { stateRef.current = { search, filterTree, sortKey, sortDir, columnFilters }; });

  const loadChunkRef = useRef(loadChunk);
  useEffect(() => { loadChunkRef.current = loadChunk; });

  const persistFilterState = useCallback((state: GridFilterState) => {
    grid.saveFilterState(state);
  }, [grid]);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      if (grid.columns.length === 0) await grid.loadColumns();
      setColumns([...grid.columns]);

      // Load persisted state (search/sort/filter) from localStorage
      const savedState = grid.loadFilterState();
      const savedSortKey = savedState?.sortKey ?? "";
      const savedSortDir = savedState?.sortDir ?? "ASC";

      // If grid.parentFilter is already set (e.g. by display() for child grids),
      // use it instead of loading UI filters from localStorage, but keep saved sort.
      if (grid.parentFilter) {
        setSortKey(savedSortKey);
        setSortDir(savedSortDir);
        setFilterTree(null);  // Don't store parent filter in React state - buildEft reads it fresh
        if (isInfinite) {
          nextOffsetRef.current = 0;
          await loadChunk(0, "", grid.parentFilter, savedSortKey, savedSortDir, { replace: true });
        } else {
          await doFetch({ page: 0, sort: savedSortKey, dir: savedSortDir, filter: grid.parentFilter });
        }
        return;
      }

      // Normal case: restore persisted state

      const savedSearch = savedState?.search ?? "";
      const savedFilterTree = savedState?.filterTree ?? null;
      const savedColumnFilters = savedState?.columnFilters ?? {};
      const savedEffectiveFilter = mergeFilters(savedFilterTree, buildColFilterTree(savedColumnFilters, grid.columns));

      setSearch(savedSearch);
      setSortKey(savedSortKey);
      setSortDir(savedSortDir);
      setFilterTree(savedFilterTree);
      setColumnFilters(savedColumnFilters);

      if (isInfinite) {
        nextOffsetRef.current = 0;
        await loadChunk(0, savedSearch, savedEffectiveFilter, savedSortKey, savedSortDir, { replace: true });
      } else {
        await doFetch({ page: 0, search: savedSearch, sort: savedSortKey, dir: savedSortDir, filter: savedEffectiveFilter });
      }
    })();
  }, [grid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── onFetch hook ──────────────────────────────────────────────────────────
  useEffect(() => {
    grid.onFetch = () => {
      if (isInfinite) {
        const { search: sv, filterTree: ft, sortKey: sk, sortDir: sd, columnFilters: cf } = stateRef.current;
        const eft = buildEft(ft, cf, grid.columns);
        prefetchRef.current = null;
        nextOffsetRef.current = 0;
        scrollRef.current?.scrollTo(0, 0);
        loadChunkRef.current(0, sv, eft, sk, sd, { replace: true });
      } else {
        setRows([...grid.rows]);
        setTotal(grid.totalRows);
      }
    };
    return () => { grid.onFetch = null; };
  }, [grid, isInfinite]);

  // ── Infinite: prefetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInfinite || isLoading || loadingMore || !hasMore) return;
    const { search: sv, filterTree: ft, sortKey: sk, sortDir: sd, columnFilters: cf } = stateRef.current;
    const eft = buildEft(ft, cf, grid.columns);
    const timer = setTimeout(() => {
      loadChunkRef.current(nextOffsetRef.current, sv, eft, sk, sd, { preload: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [rows.length, isLoading, loadingMore, total, isInfinite]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite: scroll listener ─────────────────────────────────────────────
  useEffect(() => {
    if (!isInfinite) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (isLoading || loadingMore || !hasMore) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        const { search: sv, filterTree: ft, sortKey: sk, sortDir: sd, columnFilters: cf } = stateRef.current;
        const eft = buildEft(ft, cf, grid.columns);
        loadChunkRef.current(nextOffsetRef.current, sv, eft, sk, sd);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isLoading, loadingMore, hasMore, isInfinite]);

  // ── Infinite: reset + reload ──────────────────────────────────────────────
  const infiniteReset = useCallback((sv: string, ft: FilterTree, sk: string, sd: string) => {
    prefetchRef.current = null;
    nextOffsetRef.current = 0;
    scrollRef.current?.scrollTo(0, 0);
    loadChunkRef.current(0, sv, ft, sk, sd, { replace: true });
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleSort = (col: ColumnDef) => {
    if (!col.sortable) return;
    const newDir: "ASC" | "DESC" = sortKey === col.key && sortDir === "ASC" ? "DESC" : "ASC";
    setSortKey(col.key);
    setSortDir(newDir);
    persistFilterState({ search, sortKey: col.key, sortDir: newDir, filterTree, columnFilters });
    const eft = buildEft(filterTree, columnFilters);
    if (isInfinite) {
      infiniteReset(search, eft, col.key, newDir);
    } else {
      setPage(0);
      doFetch({ page: 0, sort: col.key, dir: newDir, filter: eft });
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    persistFilterState({ search: val, sortKey, sortDir, filterTree, columnFilters });
    const eft = buildEft(filterTree, columnFilters);
    if (isInfinite) {
      infiniteReset(val, eft, sortKey, sortDir);
    } else {
      setPage(0);
      doFetch({ page: 0, search: val, filter: eft });
    }
  };

  const handleApplyFilter = (tree: FilterTree) => {
    const t = tree ?? null;
    setFilterTree(t);
    persistFilterState({ search, sortKey, sortDir, filterTree: t, columnFilters });
    const eft = buildEft(t, columnFilters);
    if (isInfinite) {
      infiniteReset(search, eft, sortKey, sortDir);
    } else {
      setPage(0);
      doFetch({ page: 0, filter: eft });
    }
  };

  const handleColFilterChange = (key: string, val: string) => {
    const next = { ...columnFilters };
    if (val.trim()) next[key] = val; else delete next[key];
    setColumnFilters(next);
    persistFilterState({ search, sortKey, sortDir, filterTree, columnFilters: next });
    const eft = buildEft(filterTree, next);
    if (isInfinite) {
      infiniteReset(search, eft, sortKey, sortDir);
    } else {
      setPage(0);
      doFetch({ page: 0, filter: eft });
    }
  };

  const handleColFilterClear = (key: string) => {
    const next = { ...columnFilters };
    delete next[key];
    setColumnFilters(next);
    if (activeColFilter === key) setActiveColFilter(null);
    const eft = buildEft(filterTree, next);
    if (isInfinite) {
      infiniteReset(search, eft, sortKey, sortDir);
    } else {
      setPage(0);
      doFetch({ page: 0, filter: eft });
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const visibleCols = columns.filter(c => !c.hidden);
  const pageSize    = grid.pageSize;
  const totalPages  = Math.max(1, Math.ceil(total / (pageSize || 1)));
  const currentPage = page + 1;
  const colFilterCount = Object.keys(columnFilters).length;

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderRow = (row: Row) => {
    const oid = row.oid as string;
    const isSel = oid === selectedOid;
    return (
      <div key={oid}
        data-testid={`grid-row-${grid.key || "grid"}-${oid}`}
        onClick={() => { setSelectedOid(oid); if (grid.mode === "lookup") { grid.onSelect?.(row); } else if (grid.panel) { grid.panel.display(row); } }}
        style={{ display: "flex", borderBottom: "1px solid var(--border-light, var(--border))", borderLeft: isSel ? "2px solid var(--accent)" : "2px solid transparent", background: isSel ? "var(--bg-selected, rgba(14,134,202,0.08))" : "transparent", cursor: "pointer" }}
        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.03))"; }}
        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
      >
        {showInlineAdd && <div style={{ flex: "0 0 32px", width: 32 }} />}
        {visibleCols.map(col => (
          <div key={col.key} style={{ flex: col.width ? `0 0 ${col.width}px` : 1, minWidth: col.width ?? 80, padding: "7px 10px", fontSize: "0.82rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: col.align ?? "left" }}>
            <CellRenderer col={col} row={row} />
          </div>
        ))}
        {isAdmin && <div style={{ flex: "0 0 32px", width: 32 }} />}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", background: "var(--bg-surface)" }}>

      {grid.showToolbar && <GridToolbar
        grid={grid}
        search={search}
        sortKey={sortKey}
        sortDir={sortDir}
        filterActive={!!filterTree && countConditions(filterTree) > 0 || colFilterCount > 0}
        filterOpen={filterOpen}
        onSearchChange={handleSearch}
        onColumnsChanged={() => { setColumns([...grid.columns]); grid.saveColumnPrefs(); }}
        onFilterOpen={() => setFilterOpen(true)}
        onApplyFilter={handleApplyFilter}
        onClearFilter={() => {
          setColumnFilters({});
          setActiveColFilter(null);
          persistFilterState({ search, sortKey, sortDir, filterTree: null, columnFilters: {} });
          handleApplyFilter(null);
        }}
      />}

      {/* Column headers — desktop only */}
      {!isMobile && <div style={{ display: "flex", flexShrink: 0, background: "var(--bg-surface-alt)", borderBottom: activeColFilter ? "none" : "1px solid var(--border)", overflowX: "hidden" }}>
        {showInlineAdd && (
          <div
            onClick={(e) => { e.stopPropagation(); grid.panel?.newRecord(); }}
            style={{ flex: "0 0 32px", width: 32, padding: "7px 6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--accent)" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            title="Add"
          >
            <Icon name="plus" size={15} />
          </div>
        )}
        {visibleCols.length === 0
          ? <div style={{ padding: "7px 10px", fontSize: "0.72rem", color: "var(--text-muted)" }}>Loading…</div>
          : visibleCols.map(col => {
            const hasColFilter = !!columnFilters[col.key];
            return (
              <div key={col.key}
                data-testid={`grid-header-${grid.key || "grid"}-${col.key}`}
                onClick={() => handleSort(col)}
                style={{ flex: col.width ? `0 0 ${col.width}px` : 1, minWidth: col.width ?? 80, padding: "7px 10px", display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", cursor: col.sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap" }}
                onMouseEnter={e => { if (col.sortable) e.currentTarget.style.color = "var(--text-primary)"; }}
                onMouseLeave={e => { if (col.sortable) e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{col.getLabel()}</span>
                {col.sortable && sortKey === col.key && <Icon name={sortDir === "ASC" ? "chevUp" : "chevDown"} size={11} />}
                {/* Per-column filter icon */}
                {col.dataType !== "boolean" && (
                  hasColFilter ? (
                    <span
                      title={`Clear filter: ${columnFilters[col.key]}`}
                      onClick={e => { e.stopPropagation(); handleColFilterClear(col.key); }}
                      style={{ color: "var(--accent)", cursor: "pointer", display: "inline-flex", flexShrink: 0 }}
                    >
                      <Icon name="x" size={10} />
                    </span>
                  ) : (
                    <span
                      title="Filter this column"
                      onClick={e => { e.stopPropagation(); setActiveColFilter(prev => prev === col.key ? null : col.key); }}
                      style={{ color: "var(--text-muted)", opacity: activeColFilter === col.key ? 1 : 0.4, cursor: "pointer", display: "inline-flex", flexShrink: 0 }}
                    >
                      <Icon name="filter" size={10} />
                    </span>
                  )
                )}
              </div>
            );
          })
        }
        {isAdmin && (
          <div
            onClick={(e) => { e.stopPropagation(); DrawerService.push(new GridDesigner(grid)); }}
            style={{ flex: "0 0 32px", width: 32, padding: "7px 6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
            title="Grid Designer"
          >
            <Icon name="settings" size={16} />
          </div>
        )}
      </div>}

      {/* Column filter input row */}
      {activeColFilter && (
        <div style={{ display: "flex", flexShrink: 0, background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", overflowX: "hidden" }}>
          {showInlineAdd && <div style={{ flex: "0 0 32px", width: 32 }} />}
          {visibleCols.map(col => (
            <div key={col.key} style={{ flex: col.width ? `0 0 ${col.width}px` : 1, minWidth: col.width ?? 80, padding: "3px 6px" }}>
              {col.key === activeColFilter ? (
                <input
                  ref={colFilterInputRef}
                  type="text"
                  value={columnFilters[col.key] || ""}
                  placeholder={`Filter ${col.getLabel()}…`}
                  onChange={e => setColumnFilters(prev => {
                    const next = { ...prev };
                    if (e.target.value) next[col.key] = e.target.value; else delete next[col.key];
                    return next;
                  })}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      handleColFilterChange(col.key, (e.target as HTMLInputElement).value);
                    }
                    if (e.key === "Escape") setActiveColFilter(null);
                  }}
                  onBlur={e => handleColFilterChange(col.key, e.target.value)}
                  style={{ width: "100%", padding: "3px 6px", fontSize: "0.75rem", border: "1px solid var(--accent)", borderRadius: 4, background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none" }}
                />
              ) : columnFilters[col.key] ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", fontSize: "0.75rem", borderRadius: 4, background: "var(--accent-light, rgba(14,134,202,0.1))", color: "var(--accent)" }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{columnFilters[col.key]}</span>
                  <button onClick={() => handleColFilterClear(col.key)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", display: "flex", padding: 0, flexShrink: 0 }}>
                    <Icon name="x" size={10} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {isAdmin && <div style={{ flex: "0 0 32px", width: 32 }} />}
        </div>
      )}

      {/* Body */}
      <div ref={isInfinite ? scrollRef : undefined} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.82rem" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--text-muted)" }}>
            <Icon name="list" size={28} />
            <span style={{ fontSize: "0.82rem" }}>No records</span>
            {grid.panel && (
              <button
                onClick={() => grid.panel?.newRecord()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 8,
                  padding: "6px 12px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  cursor: "pointer",
                }}
              >
                <Icon name="plus" size={14} />
                New
              </button>
            )}
          </div>
        ) : isMobile ? (
          rows.map(row => {
            const oid = row.oid as string;
            const isSel = oid === selectedOid;
            const custom = grid.renderCard(row, isSel);
            return (
              <div key={oid} onClick={() => { setSelectedOid(oid); if (grid.mode === "lookup") { grid.onSelect?.(row); } else if (grid.panel) { grid.panel.display(row); } }}>
                {custom ?? <DefaultCard row={row} columns={visibleCols} isSelected={isSel} />}
              </div>
            );
          })
        ) : (
          rows.map(renderRow)
        )}
      </div>

      {/* Infinite scroll footer — always visible at bottom */}
      {isInfinite && grid.showFooter && !isLoading && rows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "5px 10px", flexShrink: 0, fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-surface)", borderTop: "1px solid var(--border)", gap: 6 }}>
          {loadingMore ? (
            <><SpinnerIcon />Loading more…</>
          ) : (
            <span>{total.toLocaleString()} record{total !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {/* Paged footer */}
      {!isInfinite && grid.showFooter && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", flexShrink: 0, fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
          <span>{total} row{total !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <NavButton icon="chevFirst" disabled={currentPage <= 1}          onClick={() => { setPage(0); doFetch({ page: 0 }); }} />
            <NavButton icon="chevLeft"  disabled={currentPage <= 1}          onClick={() => { setPage(page - 1); doFetch({ page: page - 1 }); }} />
            <span style={{ padding: "0 6px" }}>{currentPage} of {totalPages}</span>
            <NavButton icon="chevRight" disabled={currentPage >= totalPages} onClick={() => { setPage(page + 1); doFetch({ page: page + 1 }); }} />
            <NavButton icon="chevLast"  disabled={currentPage >= totalPages} onClick={() => { setPage(totalPages - 1); doFetch({ page: totalPages - 1 }); }} />
          </div>
        </div>
      )}

      {filterOpen && (
        <AdvancedSearch
          columns={columns}
          colTypes={colTypes()}
          filters={filterTree}
          gridKey={grid.key || grid.dataSource?.table || ""}
          onChange={setFilterTree}
          onApply={tree => handleApplyFilter(tree ?? null)}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}

function NavButton({ icon, disabled, onClick }: { icon: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", color: disabled ? "var(--text-muted)" : "var(--text-secondary)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}>
      <Icon name={icon} size={12} />
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="22 8" />
    </svg>
  );
}

// ─── DefaultCard ──────────────────────────────────────────────────────────────

function DefaultCard({ row, columns, isSelected }: {
  row: Row;
  columns: ColumnDef[];
  isSelected: boolean;
}) {
  const cardCols = columns.filter(c => !c.hideOnMobile);
  const primary   = cardCols[0];
  const secondary = cardCols.slice(1);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 14px",
      borderBottom: "1px solid var(--border-light, var(--border))",
      background: isSelected ? "var(--bg-selected, rgba(14,134,202,0.08))" : "transparent",
      cursor: "pointer",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {primary && (
          <div style={{ fontSize: "0.875rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
            <CellRenderer col={primary} row={row} />
          </div>
        )}
        {secondary.length > 0 && (
          <div style={{ fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)", marginTop: 2 }}>
            {secondary.map((col, i) => (
              <span key={col.key}>{i > 0 && " · "}<CellRenderer col={col} row={row} /></span>
            ))}
          </div>
        )}
      </div>
      <Icon name="chevRight" size={14} style={{ color: "var(--text-muted)", flexShrink: 0 } as any} />
    </div>
  );
}
