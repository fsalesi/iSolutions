"use client";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { LayoutEntry, FormField, TableInfo } from "../types";
import { humanize } from "../utils";
import { Input, Select, Toggle } from "@/components/ui";

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;

type CustomRenderer = "text" | "textarea" | "checkbox";

function nextPlacement(layout: LayoutEntry[], sectionKey: string): { row: number; col: number } {
  const entries = layout.filter((l) =>
    (l.layout_type === "field" || l.layout_type === "child_grid") &&
    l.parent_key === sectionKey &&
    !l.properties?.hidden,
  );
  const maxRow = entries.reduce((m, e) => Math.max(m, Number(e.properties?.row || 0)), 0);
  return { row: maxRow > 0 ? maxRow + 1 : 1, col: 1 };
}

export function AddFieldPanel({ open, layout, fields, tableName, tables, formKey, sections, onAdded }: {
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

  const [customOpen, setCustomOpen] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [customRenderer, setCustomRenderer] = useState<CustomRenderer>("text");
  const [customSection, setCustomSection] = useState("");
  const [customTransient, setCustomTransient] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customError, setCustomError] = useState("");

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

  const sectionOptions = sections.length > 0
    ? sections
    : [{ key: "details", label: "Details" }];

  const occupiedKeys = useMemo(() => new Set(
    layout
      .filter((l) => l.layout_type === "field" && l.table_name === tableName)
      .map((l) => l.layout_key),
  ), [layout, tableName]);

  const [supportsCustomFieldStorage, setSupportsCustomFieldStorage] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!tableName) {
      setSupportsCustomFieldStorage(true);
      return;
    }
    fetch(`/api/table_schema?tables=${encodeURIComponent(tableName)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const hasCustomFields = rows.some((r: any) => String(r?.table_name || "") === tableName && String(r?.field_name || "") === "custom_fields");
        setSupportsCustomFieldStorage(hasCustomFields);
      })
      .catch(() => {
        if (!cancelled) setSupportsCustomFieldStorage(true);
      });
    return () => { cancelled = true; };
  }, [tableName]);

  const validateCustomKey = (raw: string): string => {
    const key = raw.trim();
    if (!key) return "Key is required";
    if (!SAFE_KEY.test(key)) return "Key must be snake_case (lowercase, numbers, underscore)";
    if (occupiedKeys.has(key)) return `Key \"${key}\" already exists`;
    return "";
  };

  const createCustomField = async () => {
    const key = customKey.trim();
    const err = validateCustomKey(key);
    if (err) { setCustomError(err); return; }
    if (!customTransient && !supportsCustomFieldStorage) {
      setCustomError('This table does not support persisted custom fields (missing custom_fields column). Enable Transient or add custom_fields JSONB column.');
      return;
    }

    const targetSection = customSection || sectionOptions[0].key;
    const place = nextPlacement(layout, targetSection);
    const label = customLabel.trim() || humanize(key);
    const sortOrder = place.row * 100 + place.col;

    setSavingCustom(true);
    setCustomError("");
    try {
      const fieldRes = await fetch("/api/form_layout?table=form_layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _table: "form_layout",
          domain: "*",
          form_key: formKey,
          table_name: tableName,
          layout_type: "field",
          layout_key: key,
          parent_key: targetSection,
          sort_order: sortOrder,
          properties: {
            label,
            renderer: customRenderer,
            mandatory: false,
            hidden: false,
            col_span: 1,
            row: place.row,
            col: place.col,
            custom_field: true,
            transient: customTransient,
          },
        }),
      });
      if (!fieldRes.ok) {
        const data = await fieldRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create custom field");
      }
      const createdField = await fieldRes.json();
      onAdded?.(createdField);

      setCustomKey("");
      setCustomLabel("");
      setCustomRenderer("text");
      setCustomTransient(!supportsCustomFieldStorage);
      setCustomSection("");
      setCustomOpen(false);
    } catch (e: any) {
      setCustomError(e?.message || "Failed to create custom field");
    } finally {
      setSavingCustom(false);
    }
  };

  if (!open) return null;

  const placedKeys = new Set(
    layout.filter((l) => l.layout_type === "field" && l.table_name === tableName && !l.properties?.hidden).map((l) => l.layout_key)
  );
  const unplaced = fields.filter((f) => f.table_name === tableName && !placedKeys.has(f.field_name));

  const placedGrids = new Set(
    layout.filter((l) => l.layout_type === "child_grid" && !l.properties?.hidden).map((l) => l.layout_key)
  );
  const childTables = (tables || []).filter((t) => t.parent_table === tableName && !placedGrids.has(t.table_name));

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
        width: 270, maxHeight: collapsed ? "auto" : 420,
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}
    >
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

      {!collapsed && (
        <div style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            data-no-drag
            onClick={() => {
              setCustomOpen((v) => !v);
              setCustomError("");
              if (!supportsCustomFieldStorage) setCustomTransient(true);
            }}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-muted)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {customOpen ? "−" : "+"} Add Custom Field
          </button>

          {customOpen && (
            <div data-no-drag style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 8, display: "grid", gap: 8 }}>
              <Input value={customKey} onChange={(v) => setCustomKey(v.trim().toLowerCase())} placeholder="key (e.g. emergency_note)" />
              <Input value={customLabel} onChange={setCustomLabel} placeholder="Label (optional)" />
              <Select
                value={customRenderer}
                onChange={(v) => setCustomRenderer(v as CustomRenderer)}
                options={[
                  { value: "text", label: "Text" },
                  { value: "textarea", label: "Textarea" },
                  { value: "checkbox", label: "Toggle" },
                ]}
              />
              <Select
                value={customSection || sectionOptions[0].key}
                onChange={setCustomSection}
                options={sectionOptions.map((s) => ({ value: s.key, label: s.label }))}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Transient (do not persist)</span>
                <Toggle
                  value={customTransient}
                  onChange={v => {
                    if (!supportsCustomFieldStorage) {
                      setCustomTransient(true);
                      return;
                    }
                    setCustomTransient(!!v);
                  }}
                  disabled={!supportsCustomFieldStorage}
                />
              </div>
              {!supportsCustomFieldStorage && (
                <div style={{ fontSize: 11, color: "var(--warning-text)" }}>
                  Persistent custom fields are unavailable for this table (no custom_fields column).
                </div>
              )}
              {customError && (
                <div style={{ fontSize: 11, color: "var(--danger-text)" }}>{customError}</div>
              )}
              <button
                data-no-drag
                disabled={savingCustom}
                onClick={createCustomField}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--accent)",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: savingCustom ? 0.7 : 1,
                }}
              >
                {savingCustom ? "Creating..." : "Create"}
              </button>
            </div>
          )}

          {totalItems === 0 && (
            <div className="text-xs" style={{ color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
              All elements placed
            </div>
          )}

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
