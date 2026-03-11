import type { ReactNode } from "react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { PanelDef } from "./PanelDef";
import type { TabDef } from "./TabDef";
import { DrawerService } from "./DrawerService";
import { addSectionLayout } from "./PanelLayoutRuntime";
import { SectionDesigner } from "./SectionDesigner";

export class AddSectionDesigner {
  title = "Add Section";
  drawerKey = "add-section-designer";

  constructor(public panel: PanelDef, public tab: TabDef) {}

  show(): ReactNode {
    return <AddSectionDesignerPanel designer={this} />;
  }
}

function toSectionKey(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^a-zA-Z]+/, "")
    .toLowerCase();
}

function AddSectionDesignerPanel({ designer }: { designer: AddSectionDesigner }) {
  const panel = designer.panel;
  const tab = designer.tab;
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [columns, setColumns] = useState("2");
  const [hideLabel, setHideLabel] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const finalKey = (key.trim() || toSectionKey(label)).trim();
    const parsedColumns = Math.max(1, Math.min(4, Number(columns) || 2));
    setSaving(true);
    setError(null);
    try {
      await addSectionLayout(panel, tab, {
        key: finalKey,
        label: label.trim() || finalKey,
        columns: parsedColumns,
        hideLabel,
        hidden,
      });
      const section = panel.getSection(finalKey);
      DrawerService.push(new SectionDesigner(panel, section));
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
          Tab
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {tab.key}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Section Label
        </label>
        <Input value={label} onChange={setLabel} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Section Key
        </label>
        <Input value={key} onChange={setKey} placeholder={toSectionKey(label) || "new_section"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Columns
        </label>
        <Input value={columns} onChange={setColumns} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Hidden</span>
          <Toggle value={hidden} onChange={v => setHidden(!!v)} />
        </label>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Hide Label</span>
          <Toggle value={hideLabel} onChange={v => setHideLabel(!!v)} />
        </label>
      </div>

      {error && (
        <div style={{ color: "var(--danger-text, #e53e3e)", fontSize: "0.78rem" }}>{error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => DrawerService.push(designer)}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Back
        </button>
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
            disabled={saving}
            style={{
              padding: "8px 12px", borderRadius: 6, border: "1px solid var(--accent)",
              background: "var(--accent)", color: "white", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Add Section"}
          </button>
        </div>
      </div>
    </div>
  );
}
