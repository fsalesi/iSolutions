"use client";
import { useState, useEffect } from "react";
import { Field, Input, Select, Toggle } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import type { LayoutEntry } from "../types";
import { RENDERER_OPTIONS, MANDATORY_OPTIONS, READONLY_OPTIONS } from "../utils";
import { TranslationsSection } from "./TranslationsSection";
import { LookupPropertiesPanel } from "./LookupPropertiesPanel";
import * as LookupPresets from "@/components/lookup/presets";

const PANEL_TABS = [
  { key: "properties", label: "Properties" },
  { key: "translations", label: "Translations" },
];

export function FieldPropertiesPanel({ entry, open, onClose, onSaved, onDeleted, sections, sectionColumns, layoutEntries }: {
  entry: LayoutEntry | null; open: boolean;
  onClose: () => void;
  onSaved: (updated: LayoutEntry) => void;
  onDeleted: (oid: string) => void;
  sections?: { key: string; label: string }[];
  sectionColumns?: number;
  layoutEntries?: LayoutEntry[];
}) {
  const [activeTab, setActiveTab] = useState("properties");
  const [props, setProps] = useState<Record<string, any>>({});
  const [parentKey, setParentKey] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [lookupPanelOpen, setLookupPanelOpen] = useState(false);
  const [backendKeyFields, setBackendKeyFields] = useState<string[]>([]);
  const [supportsCustomFieldStorage, setSupportsCustomFieldStorage] = useState(true);

  useEffect(() => {
    if (entry) {
      setProps({ ...entry.properties });
      setParentKey(entry.parent_key);
      setSortOrder(entry.sort_order);
      setConfirmDelete(false);
      setActiveTab("properties");
    }
  }, [entry?.oid]);

  useEffect(() => {
    let cancelled = false;
    if (!entry?.form_key) {
      setBackendKeyFields([]);
      return;
    }

    const tableParam = entry.table_name ? `?table=${encodeURIComponent(entry.table_name)}&limit=0` : "?limit=0";
    fetch(`/api/forms/${encodeURIComponent(entry.form_key)}${tableParam}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setBackendKeyFields(Array.isArray(data.keyFields) ? data.keyFields : []);
      })
      .catch(() => {
        if (!cancelled) setBackendKeyFields([]);
      });

    return () => { cancelled = true; };
  }, [entry?.form_key, entry?.table_name]);

  useEffect(() => {
    let cancelled = false;
    if (!entry?.table_name) {
      setSupportsCustomFieldStorage(true);
      return;
    }
    fetch(`/api/table_schema?tables=${encodeURIComponent(entry.table_name)}`)
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const hasCustomFields = rows.some((r: any) => String(r?.table_name || "") === entry.table_name && String(r?.field_name || "") === "custom_fields");
        setSupportsCustomFieldStorage(hasCustomFields);
      })
      .catch(() => {
        if (!cancelled) setSupportsCustomFieldStorage(true);
      });
    return () => { cancelled = true; };
  }, [entry?.table_name]);

  const setProp = (key: string, value: any) => setProps(p => ({ ...p, [key]: value }));

  const isBackendKeyField = !!entry && backendKeyFields.includes(entry.layout_key);
  const disallowedKeyRenderers = new Set(["password", "image"]);
  const rendererOptions = isBackendKeyField
    ? RENDERER_OPTIONS.filter((o) => !disallowedKeyRenderers.has(String(o.value)))
    : RENDERER_OPTIONS;
  const effectiveRenderer = isBackendKeyField && disallowedKeyRenderers.has(String(props.renderer ?? "text"))
    ? "text"
    : (props.renderer ?? "text");

  const findSafeSlot = (targetSection: string, desiredRow: number, desiredCol: number, desiredSpan: number) => {
    const cols = Number(
      layoutEntries?.find(l => l.layout_type === "section" && l.layout_key === targetSection)?.properties?.columns || 2,
    );
    const span = Math.max(1, Math.min(Number(desiredSpan) || 1, cols));
    const startCol = Math.max(1, Math.min(Number(desiredCol) || 1, cols - span + 1));

    const collides = (row: number, col: number) => {
      const targetCells = new Set<string>();
      for (let c = col; c < col + span; c++) targetCells.add(`${row}:${c}`);

      return (layoutEntries || []).some(l => {
        if (!entry || l.oid === entry.oid) return false;
        if (l.parent_key !== targetSection) return false;
        if (!(l.layout_type === "field" || l.layout_type === "child_grid")) return false;
        if (l.properties?.hidden) return false;

        const lr = Number(l.properties?.row || 0);
        const lc = Number(l.properties?.col || 0);
        if (!lr || !lc || lr !== row) return false;
        const lSpan = Math.max(1, Math.min(Number(l.properties?.col_span) || 1, cols - lc + 1));
        for (let c = lc; c < lc + lSpan; c++) {
          if (targetCells.has(`${lr}:${c}`)) return true;
        }
        return false;
      });
    };

    const row = Math.max(1, Number(desiredRow) || 1);
    if (!collides(row, startCol)) return { row, col: startCol, span };

    for (let r = 1; r <= 250; r++) {
      for (let c = 1; c <= cols - span + 1; c++) {
        if (!collides(r, c)) return { row: r, col: c, span };
      }
    }

    return { row, col: startCol, span };
  };

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true); setError("");

    const movedSection = parentKey !== entry.parent_key;
    let effectiveProps = { ...props };
    let effectiveSort = sortOrder;

    if (isBackendKeyField) {
      // Key fields are backend-controlled: always mandatory.
      // Read-only-on-edit is enforced at runtime (forceReadOnly), so do not persist readonly=true.
      effectiveProps = { ...effectiveProps, mandatory: true };
      delete (effectiveProps as any).readonly;
      if (disallowedKeyRenderers.has(String(effectiveProps.renderer ?? "text"))) {
        effectiveProps = { ...effectiveProps, renderer: "text" };
      }
    }

    if (movedSection && layoutEntries && layoutEntries.length > 0) {
      const desiredRow = Number(props.row ?? entry.properties?.row ?? 1) || 1;
      const desiredCol = Number(props.col ?? entry.properties?.col ?? 1) || 1;
      const desiredSpan = Number(props.col_span ?? entry.properties?.col_span ?? 1) || 1;
      const slot = findSafeSlot(parentKey, desiredRow, desiredCol, desiredSpan);

      effectiveProps = {
        ...effectiveProps,
        row: slot.row,
        col: slot.col,
        col_span: slot.span,
      };
      effectiveSort = slot.row * 100 + slot.col;
    }

    if (effectiveProps.custom_field === true && effectiveProps.transient !== true && !supportsCustomFieldStorage) {
      setError('Persist Value cannot be enabled because this table does not have a custom_fields column.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/form_layout?table=form_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: entry.oid, _table: "form_layout", properties: effectiveProps, parent_key: parentKey, sort_order: effectiveSort }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
      const saved = await res.json();
      onSaved({ ...entry, properties: saved.properties || effectiveProps, parent_key: parentKey, sort_order: effectiveSort });
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };


  const handleDelete = async () => {
    if (!entry) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/form_layout?table=form_layout&oid=${entry.oid}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Delete failed");
        return;
      }
      onDeleted(entry.oid);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (!entry) return null;

  return (
    <SlidePanel
      open={open} onClose={onClose}
      title={`Field: ${entry.layout_key}`}
      tabs={PANEL_TABS} activeTab={activeTab} onTabChange={setActiveTab}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div className="px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>
        )}

        {activeTab === "properties" && (
          <>
            {isBackendKeyField && (
              <div className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" }}>
                Backend-controlled key field: Mandatory is enforced, and renderer cannot be Password or Image. Key fields are read-only on existing records.
              </div>
            )}
            <Field label="Label">
              <Input value={props.label ?? ""} onChange={v => setProp("label", v)} />
            </Field>
            <Field label="Renderer">
              <Select
                value={effectiveRenderer}
                onChange={v => setProp("renderer", v)}
                options={rendererOptions}
              />
            </Field>

            {effectiveRenderer === "lookup" && (
              <Field label="Lookup">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Select
                    value={props.lookup_preset ?? ""}
                    onChange={v => setProp("lookup_preset", v)}
                    options={[
                      { value: "", label: "— Select preset —" },
                      { value: "__custom__", label: "Custom (no preset)" },
                      ...Object.keys(LookupPresets)
                        .filter(k => k.endsWith("Lookup"))
                        .map(k => ({ value: k, label: k })),
                    ]}
                  />
                  <button
                    onClick={() => setLookupPanelOpen(true)}
                    title="Configure lookup properties"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      width: 38, height: 38, borderRadius: 6,
                      background: "var(--bg-muted)", border: "1px solid var(--border)", color: "var(--text-secondary)",
                      cursor: "pointer" }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
                  </button>
                </div>
              </Field>
            )}
            <Field label="Column Span">
              <Select value={String(props.col_span ?? "1")} onChange={v => setProp("col_span", parseInt(v) || 1)}
                options={Array.from({ length: sectionColumns || 2 }, (_, i) => ({
                  value: String(i + 1),
                  label: i + 1 === (sectionColumns || 2) ? `${i + 1} (full width)` : String(i + 1),
                }))} />
            </Field>
            <Field label="Mandatory">
              <Select
                value={String(isBackendKeyField ? true : (props.mandatory ?? false))}
                onChange={v => setProp("mandatory", v === "true")}
                options={MANDATORY_OPTIONS}
                
              />
            </Field>
            <Field label="Read-only">
              <Select
                value={String(props.readonly ?? false)}
                onChange={v => setProp("readonly", v === "true")}
                options={READONLY_OPTIONS}
                
              />
            </Field>
            <Field label="Default Value">
              <Input value={props.default_value ?? ""} onChange={v => setProp("default_value", v)} />
            </Field>
            <Field label="Placeholder">
              <Input value={props.placeholder ?? ""} onChange={v => setProp("placeholder", v)} />
            </Field>
            <Field label="Help Text">
              <Input value={props.help_text ?? ""} onChange={v => setProp("help_text", v)} />
            </Field>
            <Field label="Show Label">
              <Toggle value={props.show_label !== false} onChange={v => setProp("show_label", v)} />
            </Field>
            <Field label="Hidden">
              <Toggle value={!!props.hidden} onChange={v => setProp("hidden", v)} />
            </Field>
            {props.custom_field === true && (
              <>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                  <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Custom Field</div>
                </div>
                <Field label="Storage Key">
                  <Input value={entry.layout_key} readOnly />
                </Field>
                <Field label="Persist Value">
                  <Toggle
                    value={props.transient !== true}
                    onChange={v => setProp("transient", !v)}
                    disabled={!supportsCustomFieldStorage}
                  />
                </Field>
                {!supportsCustomFieldStorage && (
                  <div className="text-xs" style={{ color: "var(--warning-text)" }}>
                    Persisted custom fields require a custom_fields JSONB column on this table.
                  </div>
                )}
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Storage key is immutable after create. Disable Persist Value to keep this field UI-only.
                </div>
              </>
            )}
            {entry?.layout_type === "child_grid" && (
              <>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                  <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Grid Behaviour</div>
                </div>
                <Field label="Allow Add">
                  <Toggle value={props.allow_add !== false} onChange={v => setProp("allow_add", v)} />
                </Field>
                <Field label="Inquiry Only">
                  <Toggle value={!!props.inquiry_only} onChange={v => setProp("inquiry_only", v)} />
                </Field>
              </>
            )}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                  Delete Field
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="text-sm" style={{ color: "#ef4444" }}>
                    {props.custom_field === true
                      ? "Delete this custom field and remove its saved values from all records?"
                      : "Delete this field from layout? You can add it back later from the palette."}
                  </span>
                  <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#ef4444", color: "#fff" }}>Yes, Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>No</button>
                </div>
              )}
            </div>

            {sections && sections.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                  <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>Placement</div>
                </div>
                <Field label="Section">
                  <Select value={parentKey} onChange={setParentKey}
                    options={sections.map(s => ({ value: s.key, label: s.label }))} />
                </Field>
                <Field label="Sort Order">
                  <Input type="number" value={String(sortOrder)} onChange={v => setSortOrder(parseInt(v) || 0)} />
                </Field>
              </>
            )}
          </>
        )}

        {activeTab === "translations" && (
          <TranslationsSection formKey={entry.form_key || ""} layoutKey={entry.layout_key} />
        )}
      </div>
      <LookupPropertiesPanel
        open={lookupPanelOpen}
        onClose={() => setLookupPanelOpen(false)}
        presetName={props.lookup_preset}
        properties={props}
        onPropertiesChange={updates => setProps(updates)}
        layoutFields={((layoutEntries || []).filter(l => l.layout_type === "field").map(l => l.layout_key))}
        formKey={entry.form_key || ""}
      />
    </SlidePanel>
  );
}
