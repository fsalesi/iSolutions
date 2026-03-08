"use client";

import { Icon } from "@/components/icons/Icon";
import { useSession } from "@/context/SessionContext";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { ColumnDef } from "@/platform/core/ColumnDef";
import { useCallback, useEffect, useRef, useState } from "react";
import { GroupNode } from "./FilterGroupNode";
import { Modal } from "./FilterModal";
import { SavedFiltersBar } from "./SavedFiltersBar";
import { findLocation, groupSelected, moveNode, removeNodes, ungroupNode } from "./filter-tree-ops";
import type { ColType, FilterGroup, FilterTree, SavedFilter } from "./filter-types";
import { cleanTree, countConditions, mkGroup } from "./filter-types";

interface AdvancedSearchProps {
  columns:  ColumnDef[];
  colTypes: Record<string, ColType>;
  filters:  FilterTree;
  gridKey:  string;
  onChange: (f: FilterTree) => void;
  onApply:  (tree?: FilterTree) => void;
  onClose:  () => void;
}

export function AdvancedSearch({ columns, colTypes, filters, gridKey, onChange, onApply, onClose }: AdvancedSearchProps) {
  const { user } = useSession();
  const userId = user.userId;
  const df = columns[0]?.key || "";
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const activeCount = filters ? countConditions(filters) : 0;
  const selCount = selection.size;

  useEffect(() => {
    if (!filters && df) onChange(mkGroup("and", df, colTypes));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = !!(gridKey && userId);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [activeName, setActiveName] = useState("");

  const fetchSaved = useCallback(() => {
    if (!canSave) return;
    fetch(`/api/saved-filters?userId=${userId}&gridId=${gridKey}`)
      .then(r => r.json()).then(setSaved).catch(() => {});
  }, [canSave, userId, gridKey]);

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
      body: JSON.stringify({ userId, gridId: gridKey, name: s.name, filtersJson: filters, isDefault: s.is_default, id: s.id }) });
    fetchSaved();
  };
  const handleSaveAs = async (name: string) => {
    if (!canSave || !filters) return;
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId: gridKey, name, filtersJson: filters, isDefault: false }) });
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
      body: JSON.stringify({ userId, gridId: gridKey, name: s.name, filtersJson: s.filters_json, isDefault: !s.is_default, id: s.id }) });
    fetchSaved();
  };

  const handleSelect = useCallback((ids: string[], checked: boolean) => {
    setSelection(prev => { const n = new Set(prev); ids.forEach(id => checked ? n.add(id) : n.delete(id)); return n; });
  }, []);

  const handleApply = () => {
    const cleaned = filters ? cleanTree(filters) as FilterGroup | null : null;
    onChange(cleaned);
    onApply(cleaned);
  };
  const clearAll = () => { onChange(null); setSelection(new Set()); setActiveName(""); onApply(null); };

  const doGroup = (logic: "and" | "or") => {
    if (filters && selCount >= 2) { onChange(groupSelected(filters, selection, logic)); setSelection(new Set()); }
  };
  const doUngroup = () => {
    if (!filters) return; let r = filters;
    for (const id of selection) { const l = findLocation(r, id); if (l) { const n = l.parent.children[l.index]; if (n.type === "group") r = ungroupNode(r, id); } }
    onChange(r); setSelection(new Set());
  };
  const doDelete = () => {
    if (!filters) return;
    const nr = removeNodes(filters, selection);
    onChange(nr.children.length === 0 ? null : nr);
    setSelection(new Set());
  };
  const doMove = (dir: -1 | 1) => { if (filters && selCount === 1) onChange(moveNode(filters, [...selection][0], dir)); };

  const hasSelGroups = filters ? [...selection].some(id => {
    function f(g: FilterGroup): boolean { for (const c of g.children) { if (c.id === id && c.type === "group") return true; if (c.type === "group" && f(c)) return true; } return false; }
    return f(filters);
  }) : false;

  const tbtn = (label: string, icon: string, onClick: () => void, disabled: boolean, danger?: boolean) => (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", color: danger ? "var(--danger-text)" : "var(--text-primary)", background: "var(--bg-surface)", fontSize: 12, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.3 : 1 }}>
      <Icon name={icon} size={13} />{label}
    </button>
  );

  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="filter" size={18} />
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{resolveClientText(tx("grid.advanced.title", "Advanced Search"))}</span>
          {activeCount > 0 && (
            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: "var(--accent)", color: "var(--accent-text)" }}>
              {resolveClientText(tx(activeCount === 1 ? "grid.advanced.filter_count_one" : "grid.advanced.filter_count", activeCount === 1 ? "{count} filter" : "{count} filters"), { count: activeCount })}
            </span>
          )}
        </div>
        <button onClick={onClose}
          style={{ padding: 4, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
          <Icon name="x" size={20} />
        </button>
      </div>

      {canSave && (
        <SavedFiltersBar saved={saved} activeName={activeName}
          onLoad={handleLoad} onSave={handleSave} onSaveAs={handleSaveAs}
          onDelete={handleDelete} onSetDefault={handleSetDefault} />
      )}

      {filters && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt, var(--bg-body))" }}>
          {tbtn(resolveClientText(tx("grid.advanced.group_and", "Group AND")), "plus", () => doGroup("and"), selCount < 2)}
          {tbtn(resolveClientText(tx("grid.advanced.group_or", "Group OR")), "plus", () => doGroup("or"), selCount < 2)}
          {tbtn(resolveClientText(tx("grid.advanced.ungroup", "Ungroup")), "expand", doUngroup, !hasSelGroups)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn("↑", "chevUp", () => doMove(-1), selCount !== 1)}
          {tbtn("↓", "chevDown", () => doMove(1), selCount !== 1)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn(resolveClientText(tx("grid.advanced.delete", "Delete")), "trash", doDelete, selCount === 0, true)}
          {selCount > 0 && (
            <span style={{ fontSize: 12, marginLeft: "auto", color: "var(--text-muted)" }}>{resolveClientText(tx("grid.advanced.selected", "{count} selected"), { count: selCount })}</span>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", minHeight: 120 }}>
        {!filters ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
            {resolveClientText(tx("grid.advanced.no_filters", 'No filters set. Click "Show Results" to fetch all records.'))}
          </div>
        ) : (
          <GroupNode group={filters} columns={columns} colTypes={colTypes} depth={0}
            selection={selection} onSelect={handleSelect}
            onChange={u => onChange(u)} onRemove={null}
            onApply={handleApply} defaultField={df} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
        <div>
          {activeCount > 0 && (
            <button onClick={clearAll}
              style={{ fontSize: 13, padding: "6px 14px", borderRadius: 6, color: "var(--danger-text)", border: "1px solid var(--danger-border)", background: "transparent", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--danger-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
              {resolveClientText(tx("grid.advanced.clear_all", "Clear All"))}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose}
            style={{ padding: "7px 18px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {resolveClientText(tx("common.actions.close", "Close"))}
          </button>
          <button onClick={handleApply}
            style={{ padding: "7px 20px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-text)", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {resolveClientText(tx("grid.advanced.show_results", "Show Results"))}
          </button>
        </div>
      </div>
    </Modal>
  );
}
