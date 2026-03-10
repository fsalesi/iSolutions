"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "@/context/SessionContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Icon } from "@/components/icons/Icon";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { DataGridDef } from "@/platform/core/DataGridDef";

interface GridToolbarProps {
  grid:             DataGridDef;
  search:           string;
  sortKey:          string;
  sortDir:          "ASC" | "DESC";
  filterActive:     boolean;
  filterOpen:       boolean;           // true while modal is open — used to refresh on close
  onApplyFilter:    (tree: any) => void; // apply a saved filter directly
  onClearFilter:    () => void;
  onSearchChange:   (v: string) => void;
  onColumnsChanged: () => void;
  onFilterOpen:     () => void;
}

export function GridToolbar({ grid, search, sortKey, sortDir, filterActive, filterOpen, onApplyFilter, onClearFilter, onSearchChange, onColumnsChanged, onFilterOpen }: GridToolbarProps) {
  const isMobile = useIsMobile();
  const showChildAdd = grid.isChildGrid && grid.mode === "browse" && !!grid.panel;
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [exportOpen,  setExportOpen]  = useState(false);
  const [exportKeys,  setExportKeys]  = useState<string[]>([]);
  const [exporting,   setExporting]   = useState(false);

  const pickerRef    = useRef<HTMLDivElement>(null);
  const exportRef    = useRef<HTMLDivElement>(null);
  const filterDropRef = useRef<HTMLDivElement>(null);

  const { user } = useSession();
  const userId = user.userId;
  const gridTable = grid.dataSource?.table || "";
  const gridKey = grid.key || gridTable;

  const [savedFilters, setSavedFilters] = useState<{ id: number; name: string; filters_json: any; is_default: boolean }[]>([]);
  const [filterDropOpen, setFilterDropOpen] = useState(false);

  const fetchSavedFilters = useCallback(() => {
    if (!userId || !gridKey) return;
    fetch(`/api/saved-filters?userId=${encodeURIComponent(userId)}&gridId=${encodeURIComponent(gridKey)}`)
      .then(r => r.json()).then(setSavedFilters).catch(() => {});
  }, [userId, gridKey]);

  // Load on mount
  useEffect(() => { fetchSavedFilters(); }, [fetchSavedFilters]);

  // Refresh when the Advanced Search modal closes
  const prevFilterOpen = useRef(filterOpen);
  useEffect(() => {
    if (prevFilterOpen.current && !filterOpen) fetchSavedFilters();
    prevFilterOpen.current = filterOpen;
  }, [filterOpen, fetchSavedFilters]);

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
      if (filterDropRef.current && !filterDropRef.current.contains(e.target as Node)) setFilterDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // When export opens, default to currently visible columns
  const handleExportOpen = () => {
    if (!exportOpen) {
      setExportKeys(grid.columns.filter(c => !c.hidden).map(c => c.key));
    }
    setExportOpen(o => !o);
  };

  const toggleColumn = (key: string) => {
    const col = grid.columns.find(c => c.key === key);
    if (!col) return;
    const visibleCount = grid.columns.filter(c => !c.hidden).length;
    if (!col.hidden && visibleCount <= 1) return;
    col.hidden = !col.hidden;
    onColumnsChanged();
  };

  const moveColumn = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= grid.columns.length) return;
    const cols = grid.columns;
    [cols[index], cols[target]] = [cols[target], cols[index]];
    onColumnsChanged();
  };

  const toggleExportKey = (key: string) => {
    setExportKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleExport = async () => {
    if (!exportKeys.length || !gridTable) return;
    setExporting(true);
    try {
      const columns = exportKeys
        .map(k => grid.columns.find(c => c.key === k))
        .filter(Boolean)
        .map(c => ({ key: c!.key, label: c!.getLabel() || c!.key }));

      const searchFields = grid.columns
        .filter(c => !c.hidden)
        .map(c => c.key);

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table:        gridTable,
          columns,
          search,
          searchFields,
          sort:         sortKey,
          dir:          sortDir.toLowerCase(),
          filename:     gridTable,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${gridTable}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", flexShrink: 0, background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>

      {showChildAdd && (
        <button
          onClick={() => grid.panel?.newRecord()}
          title={resolveClientText(tx("grid.add", "Add"))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 8px",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "none",
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--accent-text)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          <Icon name="plus" size={13} />
          {!isMobile && <span>{resolveClientText(tx("grid.add", "Add"))}</span>}
        </button>
      )}

      {grid.allowSearch && (
        <div style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: isMobile ? "none" : 280 }}>
          <Icon name="search" size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            data-testid={`grid-search-${grid.key || grid.dataSource?.table || "grid"}`}
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={resolveClientText(tx("grid.search.placeholder", "Search..."))}
            style={{ width: "100%", paddingLeft: 28, paddingRight: 8, paddingTop: 5, paddingBottom: 5, fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-body)", color: "var(--text-primary)", outline: "none" }}
          />
        </div>
      )}

      {!isMobile && <div style={{ flex: 1 }} />}

      {/* Filter — split button: left opens modal, right drops saved filters */}
      {grid.allowAdvancedFilter !== false && (
        <div ref={filterDropRef} style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "stretch", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
            {/* Main filter button */}
            <button
              onClick={onFilterOpen}
              title={resolveClientText(tx("grid.filter", "Filter"))}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 8px", fontSize: "0.75rem", fontWeight: 500, background: filterActive ? "var(--bg-hover, rgba(14,134,202,0.08))" : "transparent", color: filterActive ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", border: "none", position: "relative" }}
              onMouseEnter={e => { if (!filterActive) e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
              onMouseLeave={e => { if (!filterActive) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name="filter" size={13} />
              {!isMobile && <span>{resolveClientText(tx("grid.filter", "Filter"))}</span>}
              {filterActive && (
                <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 700, background: "var(--accent)", color: "var(--accent-text)", borderRadius: 8, padding: "0 5px", lineHeight: "16px" }}>
                  ●
                </span>
              )}
            </button>
            {/* Chevron dropdown — only when saved filters exist */}
            {savedFilters.length > 0 && (
              <button
                onClick={() => setFilterDropOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", padding: "0 5px", background: filterDropOpen ? "var(--bg-hover, rgba(0,0,0,0.06))" : "transparent", color: "var(--text-secondary)", cursor: "pointer", border: "none", borderLeft: "1px solid var(--border)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                onMouseLeave={e => { e.currentTarget.style.background = filterDropOpen ? "var(--bg-hover, rgba(0,0,0,0.06))" : "transparent"; }}
              >
                <Icon name="chevDown" size={11} />
              </button>
            )}
          </div>

          {/* Saved filters dropdown */}
          {filterDropOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 200, overflow: "hidden", paddingTop: 4, paddingBottom: 4 }}>
              {savedFilters.map(sf => (
                <button
                  key={sf.id}
                  onClick={() => { onApplyFilter(sf.filters_json); setFilterDropOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 12px", fontSize: "0.82rem", color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  <Icon name="filter" size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sf.name}</span>
                  {sf.is_default && (
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--accent)", color: "var(--accent-text)", flexShrink: 0 }}>{resolveClientText(tx("grid.saved_filter.default", "default"))}</span>
                  )}
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
                <button
                  onClick={() => { onClearFilter(); setFilterDropOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "6px 12px", fontSize: "0.82rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  {resolveClientText(tx("grid.clear_filters", "Clear Filters"))}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      {grid.allowExcelExport && (
        <div ref={exportRef} style={{ position: "relative" }}>
          <ToolbarButton icon="download" label={resolveClientText(tx("grid.export", "Export"))} active={exportOpen} onClick={handleExportOpen} mobileIconOnly={isMobile} />

          {exportOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 230, maxHeight: 420 }}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 7px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <span>{resolveClientText(tx("grid.export_columns", "Export Columns"))}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setExportKeys(grid.columns.map(c => c.key))} style={{ fontSize: "0.72rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>{resolveClientText(tx("grid.export.all", "All"))}</button>
                  <button onClick={() => setExportKeys(grid.columns.filter(c => !c.hidden).map(c => c.key))} style={{ fontSize: "0.72rem", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>{resolveClientText(tx("grid.export.visible", "Visible"))}</button>
                  <button onClick={() => setExportKeys([])} style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>{resolveClientText(tx("grid.export.none", "None"))}</button>
                </div>
              </div>

              {/* Column list */}
              <div style={{ overflowY: "auto", maxHeight: 280 }}>
                {grid.columns.map(col => {
                  const checked = exportKeys.includes(col.key);
                  return (
                    <div
                      key={col.key}
                      onClick={() => toggleExportKey(col.key)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: "0.82rem", color: checked ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${checked ? "var(--accent)" : "var(--border)"}`, background: checked ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {checked && <Icon name="check" size={10} style={{ color: "var(--accent-text)" }} />}
                      </div>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.getLabel() || col.key}</span>
                    </div>
                  );
                })}
              </div>

              {/* Export button */}
              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={handleExport}
                  disabled={exporting || exportKeys.length === 0}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "7px 12px", fontSize: "0.82rem", fontWeight: 600, borderRadius: 6, border: "none", background: exportKeys.length === 0 ? "var(--bg-body)" : "var(--accent)", color: exportKeys.length === 0 ? "var(--text-muted)" : "var(--accent-text)", cursor: exportKeys.length === 0 ? "not-allowed" : "pointer", opacity: exporting ? 0.7 : 1 }}
                >
                  <Icon name="download" size={13} />
                  {exporting ? resolveClientText(tx("grid.export.in_progress", "Exporting...")) : resolveClientText(tx(exportKeys.length === 1 ? "grid.export.count_one" : "grid.export.count", exportKeys.length === 1 ? "Export {count} column" : "Export {count} columns"), { count: exportKeys.length })}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Column picker */}
      {grid.allowColumnChanger && (
        <div ref={pickerRef} style={{ position: "relative" }}>
          <ToolbarButton icon="columns" label={resolveClientText(tx("grid.columns", "Columns"))} active={pickerOpen} onClick={() => setPickerOpen(o => !o)} mobileIconOnly={isMobile} />

          {pickerOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 220, maxHeight: 380, overflowY: "auto" }}>
              <div style={{ padding: "8px 12px 7px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {resolveClientText(tx("grid.columns", "Columns"))}
              </div>
              {grid.columns.map((col, i) => {
                const visible = !col.hidden;
                const isLastVisible = visible && grid.columns.filter(c => !c.hidden).length <= 1;
                return (
                  <div
                    key={col.key}
                    data-testid={`grid-column-option-${grid.key || "grid"}-${col.key}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", color: visible ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.82rem" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <button
                      data-testid={`grid-column-toggle-${grid.key || "grid"}-${col.key}`}
                      onClick={() => !isLastVisible && toggleColumn(col.key)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "none", border: "none", padding: 0, cursor: isLastVisible ? "not-allowed" : "pointer", opacity: isLastVisible ? 0.35 : 1 }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${visible ? "var(--accent)" : "var(--border)"}`, background: visible ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {visible && <Icon name="check" size={10} style={{ color: "var(--accent-text)" }} />}
                      </div>
                    </button>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.getLabel() || col.key}</span>
                    {visible && (
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveColumn(i, -1)} disabled={i === 0}
                          style={{ display: "flex", padding: 2, borderRadius: 3, background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.55 }}
                          onMouseEnter={e => { if (i > 0) e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = i === 0 ? "0.2" : "0.55"; }}>
                          <Icon name="chevUp" size={13} />
                        </button>
                        <button onClick={() => moveColumn(i, 1)} disabled={i === grid.columns.length - 1}
                          style={{ display: "flex", padding: 2, borderRadius: 3, background: "none", border: "none", cursor: i === grid.columns.length - 1 ? "default" : "pointer", opacity: i === grid.columns.length - 1 ? 0.2 : 0.55 }}
                          onMouseEnter={e => { if (i < grid.columns.length - 1) e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = i === grid.columns.length - 1 ? "0.2" : "0.55"; }}>
                          <Icon name="chevDown" size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function ToolbarButton({ icon, label, onClick, active, mobileIconOnly = false }: { icon: string; label: string; onClick: () => void; active?: boolean; mobileIconOnly?: boolean }) {
  const testId = `grid-toolbar-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      title={label}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 8px", fontSize: "0.75rem", fontWeight: 500, border: "1px solid var(--border)", borderRadius: 6, background: active ? "var(--bg-hover, rgba(0,0,0,0.06))" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))")}
      onMouseLeave={e => (e.currentTarget.style.background = active ? "var(--bg-hover, rgba(0,0,0,0.06))" : "transparent")}
    >
      <Icon name={icon} size={13} />
      {!mobileIconOnly && <span>{label}</span>}
    </button>
  );
}
