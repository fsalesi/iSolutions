import type { ReactNode } from "react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { PanelDef } from "./PanelDef";
import { DrawerService } from "./DrawerService";
import { addTabLayout } from "./PanelLayoutRuntime";
import { TabDesigner } from "./TabDesigner";

export class AddTabDesigner {
  title = "Add Tab";
  drawerKey = "add-tab-designer";

  constructor(public panel: PanelDef) {}

  show(): ReactNode {
    return <AddTabDesignerPanel designer={this} />;
  }
}

function toTabKey(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^[^a-zA-Z]+/, "")
    .toLowerCase();
}

function AddTabDesignerPanel({ designer }: { designer: AddTabDesigner }) {
  const panel = designer.panel;
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const finalKey = (key.trim() || toTabKey(label)).trim();
    setSaving(true);
    setError(null);
    try {
      await addTabLayout(panel, {
        key: finalKey,
        label: label.trim() || finalKey,
        hidden,
      });
      const tab = panel.getTab(finalKey);
      panel.activeTabKey = finalKey;
      DrawerService.push(new TabDesigner(panel, tab));
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
          Panel
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
          Add a new tab
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tab Label
        </label>
        <Input value={label} onChange={setLabel} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tab Key
        </label>
        <Input value={key} onChange={setKey} placeholder={toTabKey(label) || "new_tab"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>Hidden</span>
          <Toggle value={hidden} onChange={v => setHidden(!!v)} />
        </label>
      </div>

      {error && (
        <div style={{ color: "var(--danger-text, #e53e3e)", fontSize: "0.78rem" }}>{error}</div>
      )}

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
          {saving ? "Saving..." : "Add Tab"}
        </button>
      </div>
    </div>
  );
}
