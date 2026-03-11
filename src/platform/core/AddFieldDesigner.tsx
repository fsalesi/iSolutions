import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import type { PanelDef } from "./PanelDef";
import type { SectionDef } from "./SectionDef";
import { DrawerService } from "./DrawerService";
import { addFieldLayout, getFieldLayoutSettings, getFieldParentKey, moveFieldLayout, saveFieldLayoutSettings } from "./PanelLayoutRuntime";
import { FieldDesigner } from "./FieldDesigner";
import { AddCustomFieldDesigner } from "./AddCustomFieldDesigner";

export class AddFieldDesigner {
  title = "Add Field";
  drawerKey = "add-field-designer";

  constructor(public panel: PanelDef, public section: SectionDef) {}

  show(): ReactNode {
    return <AddFieldDesignerPanel designer={this} />;
  }
}

function deriveFieldRenderer(dataType?: string, renderer?: string): string {
  if (renderer === "dateDisplay") return dataType === "datetime" ? "datetime" : "date";
  if (renderer === "currency") return "number";
  if (renderer === "badge") return "text";
  if (renderer && ["text", "number", "date", "datetime", "boolean", "select", "lookup", "textarea", "password", "readonly", "image"].includes(renderer)) {
    return renderer;
  }
  if (dataType === "boolean") return "boolean";
  if (dataType === "date") return "date";
  if (dataType === "datetime") return "datetime";
  if (dataType === "number" || dataType === "decimal") return "number";
  return "text";
}

function AddFieldDesignerPanel({ designer }: { designer: AddFieldDesigner }) {
  const panel = designer.panel;
  const section = designer.section;
  const [selectedKey, setSelectedKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void panel.grid?.dataSource?.loadColumns?.().then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [panel]);

  const available = useMemo(() => {
    const ds = panel.grid?.dataSource;
    const hiddenFields = new Map(panel.fields.filter(field => field.hidden).map(field => [field.key, field]));
    return (ds?.columns ?? []).filter(column => !panel.fields.some(field => field.key === column.key && !field.hidden) || hiddenFields.has(column.key));
  }, [panel, loaded]);

  const selected = available.find(column => column.key === selectedKey) ?? available[0];
  const existingField = selected ? panel.fields.find(field => field.key === selected.key) ?? null : null;

  useEffect(() => {
    if (!selectedKey && available[0]) setSelectedKey(available[0].key);
  }, [available, selectedKey]);

  const handleSave = async () => {
    if (!selected) {
      setError("No available fields to add");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (existingField) {
        const currentSectionKey = getFieldParentKey(panel, existingField.key);
        if (currentSectionKey && currentSectionKey !== section.key) {
          await moveFieldLayout(panel, existingField, section.key);
        }
        const refreshedField = panel.getField(existingField.key);
        const existingSettings = getFieldLayoutSettings(panel, refreshedField);
        await saveFieldLayoutSettings(panel, refreshedField, {
          label: existingSettings.label ?? refreshedField.getLabel(),
          hidden: false,
          readOnly: existingSettings.readOnly ?? !!refreshedField.readOnly,
          required: existingSettings.required ?? !!refreshedField.required,
          renderer: existingSettings.renderer ?? refreshedField.renderer ?? deriveFieldRenderer(selected.dataType, selected.renderer),
          placeholder: existingSettings.placeholder ?? refreshedField.placeholder ?? "",
          maxLength: existingSettings.maxLength,
          scale: existingSettings.scale,
        });
      } else {
        await addFieldLayout(panel, section, {
          key: selected.key,
          label: selected.getLabel(),
          renderer: deriveFieldRenderer(selected.dataType, selected.renderer),
          readOnly: false,
          required: false,
          hidden: false,
        });
      }
      const field = panel.getField(selected.key);
      DrawerService.pop();
      DrawerService.push(new FieldDesigner(panel, field));
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Section
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {section.key}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Available Field
        </label>
        <select
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
          style={{
            minHeight: 38,
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            padding: "8px 10px",
          }}
        >
          {available.map(column => (
            <option key={column.key} value={column.key}>{column.getLabel()} ({column.key}){panel.fields.some(field => field.key === column.key && field.hidden) ? " [hidden]" : ""}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Preview Label
          </label>
          <Input value={selected.getLabel()} readOnly />
        </div>
      )}

      {error && (
        <div style={{ color: "var(--danger-text, #e53e3e)", fontSize: "0.78rem" }}>{error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => DrawerService.push(new AddCustomFieldDesigner(panel, section))}
            disabled={saving}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Add Custom Field
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => DrawerService.pop()}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !selected}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--accent)",
            background: "var(--accent)", color: "white", cursor: saving || !selected ? "not-allowed" : "pointer", opacity: saving || !selected ? 0.7 : 1,
          }}
        >
          {saving ? "Adding..." : "Add Field"}
        </button>
        </div>
      </div>
    </div>
  );
}
