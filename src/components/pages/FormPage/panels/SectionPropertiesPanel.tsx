"use client";
import { useState, useEffect } from "react";
import { Field, Input, Select, Toggle } from "@/components/ui";
import { IconPicker } from "@/components/ui/IconPicker";
import { SlidePanel } from "@/components/ui/SlidePanel";
import type { LayoutEntry } from "../types";
import { TranslationsSection } from "./TranslationsSection";

const COLUMN_COUNT_OPTIONS = [
  { value: "1", label: "1 column" },
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "4", label: "4 columns" },
];

const PANEL_TABS = [
  { key: "properties", label: "Properties" },
  { key: "translations", label: "Translations" },
];

export function SectionPropertiesPanel({ entry, open, onClose, onSaved, onDeleted, tabs }: {
  entry: LayoutEntry | null; open: boolean;
  onClose: () => void;
  onSaved: (updated: LayoutEntry) => void;
  onDeleted: (oid: string) => void;
  tabs: { key: string; label: string }[];
}) {
  const [activeTab, setActiveTab] = useState("properties");
  const [props, setProps] = useState<Record<string, any>>({});
  const [parentKey, setParentKey] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

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

  const handleDelete = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/form_layout?table=form_layout&oid=${entry.oid}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed"); return; }
      onDeleted(entry.oid);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); setConfirmDelete(false); }
  };

  if (!entry) return null;

  return (
    <SlidePanel
      open={open} onClose={onClose}
      title={`Section: ${entry.layout_key}`}
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
            <Field label="Icon">
              <IconPicker value={props.icon ?? ""} onChange={v => setProp("icon", v)} />
            </Field>
            <Field label="Show Label">
              <Toggle value={props.show_label !== false} onChange={v => setProp("show_label", v)} />
            </Field>
            <Field label="Columns">
              <Select value={String(props.columns ?? "2")} onChange={v => setProp("columns", parseInt(v) || 2)}
                options={COLUMN_COUNT_OPTIONS} />
            </Field>
            <Field label="Tab">
              <Select value={parentKey} onChange={v => setParentKey(v)}
                options={tabs.map(t => ({ value: t.key, label: t.label }))} />
            </Field>
            <Field label="Sort Order">
              <Input type="number" value={String(sortOrder)} onChange={v => setSortOrder(parseInt(v) || 0)} />
            </Field>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                  Delete Section
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="text-sm" style={{ color: "#ef4444" }}>Fields will become unplaced. Continue?</span>
                  <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "#ef4444", color: "#fff" }}>Yes, Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>No</button>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "translations" && (
          <TranslationsSection formKey={entry.form_key || ""} layoutKey={entry.layout_key} />
        )}
      </div>
    </SlidePanel>
  );
}
