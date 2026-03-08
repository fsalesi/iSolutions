/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { LayoutEntry } from "./types";

const DATA_TYPE_RENDERER: Record<string, string> = {
  text: "text",
  integer: "number",
  numeric: "number",
  boolean: "checkbox",
  date: "date",
  timestamptz: "datetime",
  citext: "text",
  password: "password",
  image: "image",
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

  const tableNameRef = useRef(tableName);
  useEffect(() => { tableNameRef.current = tableName; }, [tableName]);

  const toggleDesignMode = useCallback(() => setDesignMode(d => !d), []);

  const apiBase = "/api/form_layout?table=form_layout";
  const hdrs = { "Content-Type": "application/json" };

  // ── Move a field to an explicit row/col within a section ─────────────────
  // If target cell is occupied, swap. Otherwise just move.
  const handleFieldMoved = useCallback((
    dragOid: string,
    targetSection: string,
    targetRow: number,
    targetCol: number,
  ) => {
    setLayout(prev => {
      const dragged = prev.find(l => l.oid === dragOid);
      if (!dragged) return prev;

      const oldRow = dragged.properties?.row as number | undefined;
      const oldCol = dragged.properties?.col as number | undefined;
      const targetSectionCols = Number(
        prev.find(l => l.layout_type === "section" && l.layout_key === targetSection)?.properties?.columns || 2
      );
      const draggedSpan = Math.min(Number(dragged.properties?.col_span) || 1, targetSectionCols);
      const clampedTargetCol = Math.max(1, Math.min(targetCol, targetSectionCols - draggedSpan + 1));
      const targetCells = new Set<string>();
      for (let c = clampedTargetCol; c < clampedTargetCol + draggedSpan; c++) targetCells.add(`${targetRow}:${c}`);

      const conflicts = prev.filter(l => {
        if (l.oid === dragOid) return false;
        if (l.parent_key !== targetSection) return false;
        if (!(l.layout_type === "field" || l.layout_type === "child_grid")) return false;
        if (l.properties?.hidden) return false;

        const row = l.properties?.row as number | undefined;
        const col = l.properties?.col as number | undefined;
        if (row == null || col == null || row !== targetRow) return false;
        const span = Math.min(Number(l.properties?.col_span) || 1, targetSectionCols - col + 1);
        for (let c = col; c < col + span; c++) {
          if (targetCells.has(`${row}:${c}`)) return true;
        }
        return false;
      });

      // Reject ambiguous overlap drops instead of corrupting layout (disappearing fields).
      if (conflicts.length > 1) return prev;

      type Update = { oid: string; row: number; col: number; parentKey: string };
      const sourceSection = String(dragged.parent_key || targetSection);
      const updates: Update[] = [{ oid: dragOid, row: targetRow, col: clampedTargetCol, parentKey: targetSection }];
      if (conflicts.length === 1 && oldRow != null && oldCol != null) {
        updates.push({ oid: conflicts[0].oid, row: oldRow, col: oldCol, parentKey: sourceSection });
      }

      const updateMap = new Map(updates.map(u => [u.oid, u]));
      const newLayout = prev.map(l => {
        const upd = updateMap.get(l.oid);
        if (!upd) return l;
        const newProps = { ...l.properties, row: upd.row, col: upd.col };
        return { ...l, parent_key: upd.parentKey, sort_order: upd.row * 100 + upd.col, properties: newProps };
      });

      updates.forEach(u => {
        const entry = newLayout.find(l => l.oid === u.oid);
        if (!entry) return;
        fetch(`${apiBase}&oid=${u.oid}`, {
          method: "PUT", headers: hdrs,
          body: JSON.stringify({ oid: u.oid, _table: "form_layout", parent_key: entry.parent_key, sort_order: entry.sort_order, properties: entry.properties }),
        }).catch(() => {});
      });

      return newLayout;
    });
  }, []);

  // ── Drop an element from the palette into a specific cell ─────────────────
  const handleElementDropped = useCallback(async (
    data: any,
    targetSection: string,
    targetRow: number,
    targetCol: number,
  ) => {
    const tn = tableNameRef.current;
    const fk = layout.find(l => l.form_key)?.form_key ?? "";
    const domain = layout.find(l => l.domain)?.domain ?? "*";
    const sortOrder = targetRow * 100 + targetCol;
    const baseProps = { row: targetRow, col: targetCol };

    try {
      if (data.type === "field") {
        const existing = layout.find(l =>
          l.layout_type === "field" && l.table_name === tn && l.layout_key === data.field_name,
        );
        if (existing) {
          const { hidden: _, ...restProps } = existing.properties || {};
          const newProps = { ...restProps, ...baseProps, hidden: false };
          const res = await fetch(`${apiBase}&oid=${existing.oid}`, {
            method: "PUT", headers: hdrs,
            body: JSON.stringify({ ...existing, parent_key: targetSection, sort_order: sortOrder, properties: newProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
          }
        } else {
          const renderer = DATA_TYPE_RENDERER[data.data_type] || "text";
          const res = await fetch(apiBase, {
            method: "POST", headers: hdrs,
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: tn, layout_type: "field",
              layout_key: data.field_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: {
                label: data.field_name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                renderer, col_span: 1, ...baseProps,
              },
            }),
          });
          if (res.ok) {
            const created = await res.json();
            setLayout(prev => [...prev, created]);
          }
        }
      } else if (data.type === "child_grid") {
        const existing = layout.find(l =>
          l.layout_type === "child_grid" && l.layout_key === data.table_name,
        );
        if (existing) {
          const { hidden: _, ...restProps } = existing.properties || {};
          const newProps = { ...restProps, ...baseProps, hidden: false };
          const res = await fetch(`${apiBase}&oid=${existing.oid}`, {
            method: "PUT", headers: hdrs,
            body: JSON.stringify({ ...existing, parent_key: targetSection, sort_order: sortOrder, properties: newProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setLayout(prev => prev.map(l => l.oid === updated.oid ? updated : l));
          }
        } else {
          const res = await fetch(apiBase, {
            method: "POST", headers: hdrs,
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: tn, layout_type: "child_grid",
              layout_key: data.table_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: { label: data.tab_label || data.table_name, col_span: 99, ...baseProps },
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

  const handleFieldDeleted = useCallback((oid: string) => {
    setLayout(prev => prev.filter(l => l.oid !== oid));
    setSelectedField(null);
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
    layout, setLayout,
    designMode, toggleDesignMode,
    selectedField, setSelectedField,
    selectedSection, setSelectedSection,
    selectedTab, setSelectedTab,
    handleFieldMoved,
    handleElementDropped,
    handleFieldSaved,
    handleFieldAdded,
    handleFieldDeleted,
    handleSectionSaved,
    handleSectionDeleted,
    handleSectionAdded,
    handleTabSaved,
    handleTabDeleted,
    handleTabAdded,
  };
}
