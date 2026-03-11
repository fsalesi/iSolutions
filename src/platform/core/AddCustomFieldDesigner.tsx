import type { ReactNode } from "react";
import { useState } from "react";
import { Input, Select } from "@/components/ui";
import type { PanelDef } from "./PanelDef";
import type { SectionDef } from "./SectionDef";
import { DrawerService } from "./DrawerService";
import { addCustomFieldDefinition, addFieldLayout } from "./PanelLayoutRuntime";
import { FieldDesigner } from "./FieldDesigner";

export class AddCustomFieldDesigner {
  title = "Add Custom Field";
  drawerKey = "add-custom-field-designer";

  constructor(public panel: PanelDef, public section: SectionDef) {}

  show(): ReactNode {
    return <AddCustomFieldDesignerPanel designer={this} />;
  }
}

function deriveRenderer(dataType: string): string {
  if (dataType === "number") return "number";
  if (dataType === "boolean") return "boolean";
  if (dataType === "date") return "date";
  if (dataType === "datetime") return "datetime";
  if (dataType === "image") return "image";
  return "text";
}

function AddCustomFieldDesignerPanel({ designer }: { designer: AddCustomFieldDesigner }) {
  const panel = designer.panel;
  const section = designer.section;

  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [dataType, setDataType] = useState("text");
  const [maxLength, setMaxLength] = useState("");
  const [scale, setScale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmedKey = key.trim();
    const trimmedLabel = label.trim() || trimmedKey;
    if (!trimmedKey) {
      setError("Field key is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addCustomFieldDefinition(panel, {
        key: trimmedKey,
        label: trimmedLabel,
        dataType: dataType as any,
        renderer: deriveRenderer(dataType),
        maxLength: maxLength.trim() ? Number(maxLength) : undefined,
        scale: scale.trim() ? Number(scale) : undefined,
      });

      await addFieldLayout(panel, section, {
        key: trimmedKey,
        label: trimmedLabel,
        renderer: deriveRenderer(dataType),
        hidden: false,
        readOnly: false,
        required: false,
        maxLength: maxLength.trim() ? Number(maxLength) : undefined,
        scale: scale.trim() ? Number(scale) : undefined,
      });

      const field = panel.getField(trimmedKey);
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Field Key
          </label>
          <Input value={key} onChange={setKey} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Label
          </label>
          <Input value={label} onChange={setLabel} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Data Type
          </label>
          <Select
            value={dataType}
            onChange={v => setDataType(String(v))}
            options={[
              { value: "text", label: "Text" },
              { value: "number", label: "Number" },
              { value: "boolean", label: "Boolean" },
              { value: "date", label: "Date" },
              { value: "datetime", label: "Date/Time" },
              { value: "image", label: "Image" },
            ]}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Max Length
          </label>
          <Input value={maxLength} onChange={setMaxLength} readOnly={dataType !== "text"} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Scale
          </label>
          <Input value={scale} onChange={setScale} readOnly={dataType !== "number"} />
        </div>
      </div>

      {error && <div style={{ color: "var(--danger-text, #e53e3e)", fontSize: "0.78rem" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
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
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--accent)",
            background: "var(--accent)", color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Adding..." : "Add Custom Field"}
        </button>
      </div>
    </div>
  );
}
