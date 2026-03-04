"use client";
import { useState, useEffect } from "react";
import { Section, Field, Input, Select, Checkbox, Toggle } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import type { LayoutEntry } from "../types";
import { humanize, RENDERER_OPTIONS, MANDATORY_OPTIONS, READONLY_OPTIONS } from "../utils";

export function FieldPropertiesPanel({ entry, open, onClose, onSaved, sections, sectionColumns }: {
  entry: LayoutEntry | null; open: boolean;
  onClose: () => void;
  onSaved: (updated: LayoutEntry) => void;
  sections?: { key: string; label: string }[];
  sectionColumns?: number;
}) {
  const [props, setProps] = useState<Record<string, any>>({});
  const [parentKey, setParentKey] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      setProps({ ...entry.properties });
      setParentKey(entry.parent_key);
      setSortOrder(entry.sort_order);
    }
  }, [entry?.oid]);

  const setProp = (key: string, value: any) => setProps(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/form_layout?table=form_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: entry.oid, _table: "form_layout", properties: props, parent_key: parentKey, sort_order: sortOrder }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Save failed");
        return;
      }
      const saved = await res.json();
      onSaved({ ...entry, properties: saved.properties || props, parent_key: parentKey, sort_order: sortOrder });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!entry) return null;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={`Field: ${entry.layout_key}`}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 4px" }}>
        {error && (
          <div className="px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        <Field label="Label">
          <Input value={props.label ?? ""} onChange={v => setProp("label", v)} />
        </Field>

        <Field label="Renderer">
          <Select value={props.renderer ?? "text"} onChange={v => setProp("renderer", v)}
            options={RENDERER_OPTIONS} />
        </Field>

        <Field label="Column Span">
          <Select value={String(props.col_span ?? "1")} onChange={v => setProp("col_span", parseInt(v) || 1)}
            options={Array.from({ length: sectionColumns || 2 }, (_, i) => ({
              value: String(i + 1),
              label: i + 1 === (sectionColumns || 2) ? `${i + 1} (full width)` : String(i + 1),
            }))} />
        </Field>

        <Field label="Mandatory">
          <Select value={String(props.mandatory ?? "false")} onChange={v => setProp("mandatory", v === "true")}
            options={MANDATORY_OPTIONS} />
        </Field>

        <Field label="Read-only">
          <Select value={String(props.readonly ?? "false")} onChange={v => setProp("readonly", v === "true")}
            options={READONLY_OPTIONS} />
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

        <Field label="Hidden">
          <Toggle value={!!props.hidden} onChange={v => setProp("hidden", v)} />
        </Field>

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
      </div>
    </SlidePanel>
  );
}

/* ── Section Properties Slide-in (Step 3) ── */
const COLUMN_COUNT_OPTIONS = [
  { value: "1", label: "1 column" },
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "4", label: "4 columns" },
];

