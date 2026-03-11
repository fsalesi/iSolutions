import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { PanelDef } from "./PanelDef";
import type { TabDef } from "./TabDef";
import { DrawerService } from "./DrawerService";
import { AddSectionDesigner } from "./AddSectionDesigner";
import { AddTabDesigner } from "./AddTabDesigner";
import { getTabLayoutSettings, isDesignerAddedTab, moveTabLayout, removeTabLayout, saveTabLayoutSettings } from "./PanelLayoutRuntime";

export class TabDesigner {
  title = "Tab Properties";
  drawerKey = "tab-designer";

  constructor(public panel: PanelDef, public tab: TabDef) {}

  show(): ReactNode {
    return <TabDesignerPanel designer={this} />;
  }
}

function TabDesignerPanel({ designer }: { designer: TabDesigner }) {
  const panel = designer.panel;
  const tab = designer.tab;
  const existing = useMemo(() => getTabLayoutSettings(panel, tab), [panel, tab]);

  const [label, setLabel] = useState(existing.label ?? tab.getLabel());
  const [hidden, setHidden] = useState(existing.hidden ?? tab.hidden);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRemove = useMemo(() => isDesignerAddedTab(panel, tab.key) && tab.children.filter(child => child.type === "section").length === 0, [panel, tab]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveTabLayoutSettings(panel, tab, {
        label: label.trim(),
        hidden,
      });
      DrawerService.pop();
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
          Label
        </label>
        <Input value={label} onChange={setLabel} />
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => moveTabLayout(panel, tab, "up").catch(err => setError(err?.message || "Move failed"))}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Move Up
        </button>
        <button
          onClick={() => moveTabLayout(panel, tab, "down").catch(err => setError(err?.message || "Move failed"))}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Move Down
        </button>
        <button
          onClick={() => DrawerService.push(new AddTabDesigner(panel))}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Add Tab
        </button>
        <button
          onClick={() => DrawerService.push(new AddSectionDesigner(panel, tab))}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Add Section
        </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
        {canRemove && (
        <button
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await removeTabLayout(panel, tab);
              DrawerService.pop();
            } catch (err: any) {
              setError(err?.message || "Remove failed");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--danger-text, #e53e3e)",
            background: "transparent", color: "var(--danger-text, #e53e3e)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Remove
        </button>
        )}
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
          {saving ? "Saving..." : "Save"}
        </button>
        </div>
      </div>
    </div>
  );
}
