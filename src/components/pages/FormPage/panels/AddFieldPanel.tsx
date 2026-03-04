"use client";
import { useState, useRef, useCallback } from "react";
import type { LayoutEntry, FormField, TableInfo } from "../types";
import { humanize } from "../utils";

export function AddFieldPanel({ open, layout, fields, tableName, tables }: {
  open: boolean; onClose: () => void;
  layout: LayoutEntry[]; fields: FormField[]; tables?: TableInfo[];
  formKey: string; tableName: string;
  sections: { key: string; label: string }[];
  onAdded?: (entry: LayoutEntry) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((ev: React.MouseEvent) => {
    if ((ev.target as HTMLElement).closest("[data-no-drag]")) return;
    dragging.current = true;
    offset.current = { x: ev.clientX - pos.x, y: ev.clientY - pos.y };
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  if (!open) return null;

  const placedKeys = new Set(
    layout.filter(l => l.layout_type === "field" && l.table_name === tableName && !l.properties?.hidden).map(l => l.layout_key)
  );
  const unplaced = fields.filter(f => f.table_name === tableName && !placedKeys.has(f.field_name));

  const placedGrids = new Set(
    layout.filter(l => l.layout_type === "child_grid" && !l.properties?.hidden).map(l => l.layout_key)
  );
  const childTables = (tables || []).filter(t => t.parent_table === tableName && !placedGrids.has(t.table_name));

  const handleDragStart = (ev: React.DragEvent, data: Record<string, any>) => {
    ev.dataTransfer.setData("application/x-element", JSON.stringify(data));
    ev.dataTransfer.effectAllowed = "copyMove";
    (ev.currentTarget as HTMLElement).style.opacity = "0.4";
  };
  const handleDragEnd = (ev: React.DragEvent) => {
    (ev.currentTarget as HTMLElement).style.opacity = "1";
  };

  const totalItems = unplaced.length + childTables.length;

  return (
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 1000,
        width: 240, maxHeight: collapsed ? "auto" : 360,
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Title bar — draggable */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", cursor: "grab", userSelect: "none",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          background: "var(--bg-muted)",
        }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          Elements {totalItems > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({totalItems})</span>}
        </span>
        <button data-no-drag onClick={() => setCollapsed(c => !c)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1 }}>
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {totalItems === 0 && (
            <div className="text-xs" style={{ color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
              All elements placed
            </div>
          )}

          {/* Child grids */}
          {childTables.map(ct => (
            <div key={ct.table_name} draggable data-no-drag
              onDragStart={(ev) => handleDragStart(ev, {
                type: "child_grid", table_name: ct.table_name,
                tab_label: ct.tab_label || humanize(ct.table_name),
              })}
              onDragEnd={handleDragEnd}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", borderRadius: 6, background: "var(--bg-muted)",
                cursor: "grab", userSelect: "none", fontSize: 12,
              }}>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>☰</span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {ct.tab_label || humanize(ct.table_name)}
              </span>
              <span style={{ color: "var(--text-muted)", marginLeft: "auto", fontSize: 10 }}>grid</span>
            </div>
          ))}

          {/* Fields */}
          {unplaced.map(f => (
            <div key={f.field_name} draggable data-no-drag
              onDragStart={(ev) => handleDragStart(ev, {
                type: "field", field_name: f.field_name, data_type: f.data_type,
              })}
              onDragEnd={handleDragEnd}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", borderRadius: 6, background: "var(--bg-muted)",
                cursor: "grab", userSelect: "none", fontSize: 12,
              }}>
              <span style={{ color: "var(--text-muted)", fontSize: 10 }}>☰</span>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{f.field_name}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: "auto", fontSize: 10 }}>{f.data_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
