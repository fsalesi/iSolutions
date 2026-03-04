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

      // Find an occupant whose start cell is exactly the target
      const occupant = prev.find(l =>
        l.oid !== dragOid &&
        l.parent_key === targetSection &&
        (l.layout_type === "field" || l.layout_type === "child_grid") &&
        !l.properties?.hidden &&
        (l.properties?.row as number) === targetRow &&
        (l.properties?.col as number) === targetCol,
      );

      type Update = { oid: string; row: number; col: number };
      const updates: Update[] = [{ oid: dragOid, row: targetRow, col: targetCol }];
      if (occupant && oldRow != null && oldCol != null) {
        updates.push({ oid: occupant.oid, row: oldRow, col: oldCol });
      }

      const updateMap = new Map(updates.map(u => [u.oid, u]));
      const newLayout = prev.map(l => {
        const upd = updateMap.get(l.oid);
        if (!upd) return l;
        const newProps = { ...l.properties, row: upd.row, col: upd.col };
        return { ...l, sort_order: upd.row * 100 + upd.col, properties: newProps };
      });

      updates.forEach(u => {
        const entry = newLayout.find(l => l.oid === u.oid);
        if (!entry) return;
        fetch(`${apiBase}&oid=${u.oid}`, {
          method: "PUT", headers: hdrs,
          body: JSON.stringify({ oid: u.oid, _table: "form_layout", sort_order: entry.sort_order, properties: entry.properties }),
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
        const hidden = layout.find(l =>
          l.layout_type === "field" && l.table_name === tn &&
          l.layout_key === data.field_name && l.properties?.hidden,
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const newProps = { ...restProps, ...baseProps };
          const res = await fetch(`${apiBase}&oid=${hidden.oid}`, {
            method: "PUT", headers: hdrs,
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: newProps }),
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
                renderer, colSpan: 1, ...baseProps,
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
          l.layout_type === "child_grid" && l.layout_key === data.table_name && l.properties?.hidden,
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const newProps = { ...restProps, ...baseProps };
          const res = await fetch(`${apiBase}&oid=${hidden.oid}`, {
            method: "PUT", headers: hdrs,
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: newProps }),
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
    handleSectionSaved,
    handleSectionDeleted,
    handleSectionAdded,
    handleTabSaved,
    handleTabDeleted,
    handleTabAdded,
  };
}
