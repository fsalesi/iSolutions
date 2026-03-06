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

export function FieldPropertiesPanel({ entry, open, onClose, onSaved, sections, sectionColumns }: {
  entry: LayoutEntry | null; open: boolean;
  onClose: () => void;
  onSaved: (updated: LayoutEntry) => void;
  sections?: { key: string; label: string }[];
  sectionColumns?: number;
}) {
  const [activeTab, setActiveTab] = useState("properties");
  const [props, setProps] = useState<Record<string, any>>({});
  const [parentKey, setParentKey] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lookupPanelOpen, setLookupPanelOpen] = useState(false);

  useEffect(() => {
    if (entry) {
      setProps({ ...entry.properties });
      setParentKey(entry.parent_key);
      setSortOrder(entry.sort_order);
      setActiveTab("properties");
    }
  }, [entry?.oid]);

  const setProp = (key: string, value: any) => setProps(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/form_layout?table=form_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: entry.oid, _table: "form_layout", properties: props, parent_key: parentKey, sort_order: sortOrder }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
      const saved = await res.json();
      onSaved({ ...entry, properties: saved.properties || props, parent_key: parentKey, sort_order: sortOrder });
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
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
            <Field label="Label">
              <Input value={props.label ?? ""} onChange={v => setProp("label", v)} />
            </Field>
            <Field label="Renderer">
              <Select value={props.renderer ?? "text"} onChange={v => setProp("renderer", v)} options={RENDERER_OPTIONS} />
            </Field>

            {props.renderer === "lookup" && (
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
              <Select value={String(props.mandatory ?? "false")} onChange={v => setProp("mandatory", v === "true")} options={MANDATORY_OPTIONS} />
            </Field>
            <Field label="Read-only">
              <Select value={String(props.readonly ?? "false")} onChange={v => setProp("readonly", v === "true")} options={READONLY_OPTIONS} />
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
      />
    </SlidePanel>
  );
}
