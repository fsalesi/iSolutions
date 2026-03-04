"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { LayoutEntry } from "./types";

const DATA_TYPE_RENDERER: Record<string, string> = {
  text: "text", integer: "number", numeric: "number",
  boolean: "checkbox", date: "date", timestamptz: "datetime", citext: "text",
};

/**
 * useDesignLayout — single source of truth for all design-mode state + handlers.
 * Used by FormPage (main panel) and InlineCrud (child panel).
 * Owns: layout state, selection state, designMode toggle, all mutation callbacks.
 */
export function useDesignLayout(initialLayout: LayoutEntry[], tableName: string) {
  const [layout, setLayout] = useState<LayoutEntry[]>(initialLayout);
  const [designMode, setDesignMode] = useState(false);
  const [selectedField, setSelectedField] = useState<LayoutEntry | null>(null);
  const [selectedSection, setSelectedSection] = useState<LayoutEntry | null>(null);
  const [selectedTab, setSelectedTab] = useState<LayoutEntry | null>(null);

  // Keep tableName reactive without stale closures
  const tableNameRef = useRef(tableName);
  useEffect(() => { tableNameRef.current = tableName; }, [tableName]);

  const toggleDesignMode = useCallback(() => setDesignMode(d => !d), []);

  // ── Field reorder (drag-and-drop within a section) ──────────────────────────
  const handleFieldReordered = useCallback(async (
    dragOid: string,
    targetSection: string,
    targetEntryIdx: number,
    replaceSpacerOid?: string,
    appendOffset?: number,
  ) => {
    setLayout(prev => {
      const lo = [...prev];
      const draggedIdx = lo.findIndex(l => l.oid === dragOid);
      if (draggedIdx < 0) return prev;
      const dragged = { ...lo[draggedIdx] };
      // tableName is derived from the dragged element itself
      const tn = dragged.table_name;
      const formKey = dragged.form_key ?? lo.find(l => l.form_key)?.form_key ?? "";
      const domain = dragged.domain ?? lo.find(l => l.domain)?.domain ?? "";

      let entries = lo
        .filter(l => (l.layout_type === "field" || l.layout_type === "spacer") && l.table_name === tn && l.parent_key === targetSection && !l.properties?.hidden && l.oid !== dragOid)
        .sort((a, b) => a.sort_order - b.sort_order);

      const creates: LayoutEntry[] = [];
      const deletes: string[] = [];

      const mkSpacer = (): LayoutEntry => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        return {
          oid: id, form_key: formKey, domain, table_name: tn,
          layout_type: "spacer", layout_key: `spacer_${id.slice(0, 8)}`,
          parent_key: targetSection, sort_order: 0, properties: {},
        };
      };

      if (replaceSpacerOid) {
        const si = entries.findIndex(e => e.oid === replaceSpacerOid);
        if (si >= 0) { deletes.push(replaceSpacerOid); entries[si] = dragged; }
        else entries.push(dragged);
      } else if (appendOffset !== undefined && appendOffset >= 0) {
        for (let i = 0; i < appendOffset; i++) {
          const sp = mkSpacer(); entries.push(sp); creates.push(sp);
        }
        entries.push(dragged);
      } else {
        const idx = Math.max(0, Math.min(targetEntryIdx, entries.length));
        entries.splice(idx, 0, dragged);
      }

      // Trim trailing spacers
      while (entries.length > 0 && entries[entries.length - 1].layout_type === "spacer") {
        const trailing = entries.pop()!;
        if (creates.find(c => c.oid === trailing.oid)) {
          creates.splice(creates.findIndex(c => c.oid === trailing.oid), 1);
        } else {
          deletes.push(trailing.oid);
        }
      }

      const updates = entries.map((e, i) => ({ oid: e.oid, sort_order: (i + 1) * 10, parent_key: targetSection }));

      const deleteSet = new Set(deletes);
      let newLayout = lo.filter(l => !deleteSet.has(l.oid));
      const existingOids = new Set(newLayout.map(l => l.oid));
      creates.forEach(c => { if (!existingOids.has(c.oid)) newLayout.push(c); });
      const updateMap = new Map(updates.map(u => [u.oid, u]));
      newLayout = newLayout.map(l => {
        const upd = updateMap.get(l.oid);
        return upd ? { ...l, sort_order: upd.sort_order, parent_key: upd.parent_key } : l;
      });

      const apiBase = "/api/form_layout?table=form_layout";
      const hdrs = { "Content-Type": "application/json" };
      creates.forEach(c => { fetch(apiBase, { method: "POST", headers: hdrs, body: JSON.stringify({ ...c, _table: "form_layout" }) }).catch(() => {}); });
      deletes.forEach(d => { fetch(`${apiBase}&oid=${d}`, { method: "DELETE" }).catch(() => {}); });
      updates.forEach(u => { fetch(apiBase, { method: "PUT", headers: hdrs, body: JSON.stringify({ oid: u.oid, _table: "form_layout", parent_key: u.parent_key, sort_order: u.sort_order }) }).catch(() => {}); });

      return newLayout;
    });
  }, []);

  // ── Element dropped from palette (field or child_grid) ────────────────────
  const handleElementDropped = useCallback(async (
    data: any,
    targetSection: string,
    _targetEntryIdx: number,
    _replaceSpacerOid?: string,
    _appendOffset?: number,
  ) => {
    const tn = tableNameRef.current;
    const fk = layout.find(l => l.form_key)?.form_key ?? "";
    const domain = layout.find(l => l.domain)?.domain ?? "*";

    const maxSort = layout
      .filter(l => l.parent_key === targetSection && l.table_name === tn)
      .reduce((max, l) => Math.max(max, l.sort_order), -1);
    const sortOrder = maxSort + 10;

    try {
      if (data.type === "field") {
        const hidden = layout.find(l =>
          l.layout_type === "field" && l.table_name === tn &&
          l.layout_key === data.field_name && l.properties?.hidden
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const res = await fetch(`/api/form_layout?table=form_layout&oid=${hidden.oid}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: restProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
          }
        } else {
          const renderer = DATA_TYPE_RENDERER[data.data_type] || "text";
          const res = await fetch("/api/form_layout?table=form_layout", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: tn, layout_type: "field",
              layout_key: data.field_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: {
                label: data.field_name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                renderer, colSpan: 1,
              },
            }),
          });
          if (res.ok) {
            const created = await res.json();
            setLayout(prev => [...prev, created]);
          }
        }
      } else if (data.type === "child_grid") {
        const hidden = layout.find(l =>
          l.layout_type === "child_grid" && l.layout_key === data.table_name && l.properties?.hidden
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const res = await fetch(`/api/form_layout?table=form_layout&oid=${hidden.oid}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: restProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
          }
        } else {
          const res = await fetch("/api/form_layout?table=form_layout", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: tn, layout_type: "child_grid",
              layout_key: data.table_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: { label: data.tab_label || data.table_name, col_span: 99 },
            }),
          });
          if (res.ok) {
            const created = await res.json();
            setLayout(prev => [...prev, created]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to place element:", err);
    }
  }, [layout]);

  // ── Field handlers ────────────────────────────────────────────────────────
  const handleFieldSaved = useCallback((updated: LayoutEntry) => {
    setLayout(prev => prev.map(l => l.oid === updated.oid ? { ...l, ...updated } : l));
    setSelectedField(null);
  }, []);

  const handleFieldAdded = useCallback((created: LayoutEntry) => {
    setLayout(prev => [...prev, created]);
  }, []);

  // ── Section handlers ──────────────────────────────────────────────────────
  const handleSectionSaved = useCallback((updated: LayoutEntry) => {
    setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
    setSelectedSection(null);
  }, []);

  const handleSectionDeleted = useCallback((oid: string) => {
    setLayout(prev => prev.filter(l => l.oid !== oid));
    setSelectedSection(null);
  }, []);

  const handleSectionAdded = useCallback((created: LayoutEntry) => {
    setLayout(prev => [...prev, created]);
  }, []);

  // ── Tab handlers ──────────────────────────────────────────────────────────
  const handleTabSaved = useCallback((updated: LayoutEntry) => {
    setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
    setSelectedTab(null);
  }, []);

  const handleTabDeleted = useCallback((oid: string) => {
    setLayout(prev => prev.filter(l => l.oid !== oid));
    setSelectedTab(null);
  }, []);

  const handleTabAdded = useCallback((created: LayoutEntry) => {
    setLayout(prev => [...prev, created]);
  }, []);

  return {
    // Layout state
    layout, setLayout,
    // Design mode
    designMode, toggleDesignMode,
    // Selection state
    selectedField, setSelectedField,
    selectedSection, setSelectedSection,
    selectedTab, setSelectedTab,
    // Field
    handleFieldReordered,
    handleElementDropped,
    handleFieldSaved,
    handleFieldAdded,
    // Section
    handleSectionSaved,
    handleSectionDeleted,
    handleSectionAdded,
    // Tab
    handleTabSaved,
    handleTabDeleted,
    handleTabAdded,
  };
}
