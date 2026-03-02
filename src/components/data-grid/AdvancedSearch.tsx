"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { ColumnDef } from "./datagrid/types";

// Re-export types for DataGrid and external consumers
export type { ColType, FilterTree, FilterGroup, FilterNode, FilterCondition, FilterOperator } from "./datagrid/filter-types";
export { countConditions, serializeFilters } from "./datagrid/filter-types";

import type { ColType, FilterTree, FilterGroup, SavedFilter } from "./datagrid/filter-types";
import { countConditions, cleanTree, mkGroup } from "./datagrid/filter-types";
import { findLocation, removeNodes, groupSelected, ungroupNode, moveNode } from "./datagrid/filter-tree-ops";
import { GroupNode } from "./datagrid/FilterGroupNode";
import { SavedFiltersBar } from "./datagrid/SavedFiltersBar";
import { Modal } from "./datagrid/FilterModal";

// ── Main ──
interface AdvancedSearchProps {
  columns: ColumnDef<any>[];
  colTypes: Record<string, ColType>;
  filters: FilterTree;
  onChange: (f: FilterTree) => void;
  onApply: (tree?: FilterTree) => void;
  onClose: () => void;
  gridId?: string;
  userId?: string;
}

export function AdvancedSearch({ columns, colTypes, filters, onChange, onApply, onClose, gridId, userId }: AdvancedSearchProps) {
  const t = useT();
  const df = columns[0]?.key || "";
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const activeCount = filters ? countConditions(filters) : 0;
  const selCount = selection.size;

  // ── Saved filters ──
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [activeName, setActiveName] = useState("");
  const canSave = !!(gridId && userId);

  const fetchSaved = useCallback(() => {
    if (!canSave) return;
    fetch(`/api/saved-filters?userId=${userId}&gridId=${gridId}`)
      .then(r => r.json()).then(setSaved).catch(() => {});
  }, [canSave, userId, gridId]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const defaultLoaded = useRef(false);
  useEffect(() => {
    if (defaultLoaded.current || !saved.length) return;
    const def = saved.find(s => s.is_default);
    if (def && !filters) {
      onChange(def.filters_json);
      setActiveName(def.name);
      defaultLoaded.current = true;
    }
  }, [saved, filters, onChange]);

  const handleLoad = (s: SavedFilter) => { onChange(s.filters_json); setActiveName(s.name); setSelection(new Set()); };

  const handleSave = async (s: SavedFilter) => {
    if (!canSave || !filters) return;
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name: s.name, filtersJson: filters, isDefault: s.is_default, id: s.id }) });
    fetchSaved();
  };

  const handleSaveAs = async (name: string) => {
    if (!canSave || !filters) return;
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name, filtersJson: filters, isDefault: false }) });
    setActiveName(name);
    fetchSaved();
  };

  const handleDelete = async (s: SavedFilter) => {
    await fetch(`/api/saved-filters?id=${s.id}&userId=${userId}`, { method: "DELETE" });
    if (activeName === s.name) setActiveName("");
    fetchSaved();
  };

  const handleSetDefault = async (s: SavedFilter) => {
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name: s.name, filtersJson: s.filters_json, isDefault: !s.is_default, id: s.id }) });
    fetchSaved();
  };

  // ── Selection & toolbar ──
  const handleSelect = useCallback((ids: string[], checked: boolean) => {
    setSelection(prev => { const n = new Set(prev); ids.forEach(id => checked ? n.add(id) : n.delete(id)); return n; });
  }, []);

  const handleApply = () => { const cleaned = filters ? cleanTree(filters) as FilterGroup | null : null; onChange(cleaned); onApply(cleaned); };
  const clearAll = () => { onChange(null); setSelection(new Set()); setActiveName(""); onApply(null); };

  const doGroup = (logic: "and" | "or") => { if (filters && selCount >= 2) { onChange(groupSelected(filters, selection, logic)); setSelection(new Set()); } };
  const doUngroup = () => {
    if (!filters) return; let r = filters;
    for (const id of selection) { const l = findLocation(r, id); if (l) { const n = l.parent.children[l.index]; if (n.type === "group") r = ungroupNode(r, id); } }
    onChange(r); setSelection(new Set());
  };
  const doDelete = () => { if (!filters) return; const nr = removeNodes(filters, selection); onChange(nr.children.length === 0 ? null : nr); setSelection(new Set()); };
  const doMove = (dir: -1 | 1) => { if (filters && selCount === 1) onChange(moveNode(filters, [...selection][0], dir)); };

  const hasSelGroups = filters ? [...selection].some(id => {
    function f(g: FilterGroup): boolean { for (const c of g.children) { if (c.id === id && c.type === "group") return true; if (c.type === "group" && f(c)) return true; } return false; }
    return f(filters);
  }) : false;

  const tbtn = (label: string, icon: string, onClick: () => void, disabled: boolean, danger?: boolean) => (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
      style={{ border: "1px solid var(--border)", color: danger ? "#ef4444" : "var(--text-primary)", background: "var(--bg-surface)" }}>
      <Icon name={icon} size={13} />{label}
    </button>
  );

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <Icon name="filter" size={18} />
          <span className="font-semibold" style={{ color: "var(--text-primary)", fontSize: 15 }}>Advanced Search</span>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
              {activeCount} filter{activeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* Saved Filters */}
      {canSave && (
        <SavedFiltersBar saved={saved} activeName={activeName}
          onLoad={handleLoad} onSave={handleSave} onSaveAs={handleSaveAs}
          onDelete={handleDelete} onSetDefault={handleSetDefault} />
      )}

      {/* Toolbar */}
      {filters && (
        <div className="flex items-center gap-2 px-5 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)" }}>
          {tbtn(t("filter.group_and", "Group AND"), "plus", () => doGroup("and"), selCount < 2)}
          {tbtn(t("filter.group_or", "Group OR"), "plus", () => doGroup("or"), selCount < 2)}
          {tbtn(t("filter.ungroup", "Ungroup"), "expand", doUngroup, !hasSelGroups)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn("↑", "chevUp", () => doMove(-1), selCount !== 1)}
          {tbtn("↓", "chevDown", () => doMove(1), selCount !== 1)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn("Delete", "trash", doDelete, selCount === 0, true)}
          {selCount > 0 && <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{selCount} selected</span>}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 120 }}>
        {!filters ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm mb-4">No search filters defined</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => onChange(mkGroup("and", df, colTypes))}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>+ AND Group</button>
              <button onClick={() => onChange(mkGroup("or", df, colTypes))}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f59e0b", color: "#fff" }}>+ OR Group</button>
            </div>
          </div>
        ) : (
          <GroupNode group={filters} columns={columns} colTypes={colTypes} depth={0}
            selection={selection} onSelect={handleSelect}
            onChange={u => onChange(u)} onRemove={null} onApply={handleApply} defaultField={df} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div>{activeCount > 0 && (
          <button onClick={clearAll} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>Clear All</button>
        )}</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)" }}>Close</button>
          <button onClick={handleApply} className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}>Show Results</button>
        </div>
      </div>
    </Modal>
  );
}
