import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import type { PanelDef } from "./PanelDef";
import type { SectionDef } from "./SectionDef";
import { DrawerService } from "./DrawerService";
import { AddFieldDesigner } from "./AddFieldDesigner";
import { AddCustomFieldDesigner } from "./AddCustomFieldDesigner";
import { getSectionLayoutSettings, getSectionParentKey, isDesignerAddedSection, moveSectionLayout, removeSectionLayout, saveSectionLayoutSettings } from "./PanelLayoutRuntime";

export class SectionDesigner {
  title = "Section Properties";
  drawerKey = "section-designer";

  constructor(public panel: PanelDef, public section: SectionDef) {}

  show(): ReactNode {
    return <SectionDesignerPanel designer={this} />;
  }
}

function SectionDesignerPanel({ designer }: { designer: SectionDesigner }) {
  const panel = designer.panel;
  const section = designer.section;
  const existing = useMemo(() => getSectionLayoutSettings(panel, section), [panel, section]);

  const [label, setLabel] = useState(existing.label ?? section.getLabel());
  const [hidden, setHidden] = useState(existing.hidden ?? section.hidden);
  const [hideLabel, setHideLabel] = useState(existing.hideLabel ?? !!section.hideLabel);
  const [tabKey, setTabKey] = useState(getSectionParentKey(panel, section.key));
  const [columns, setColumns] = useState(String(existing.columns ?? section.columns ?? 2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRemove = useMemo(() => isDesignerAddedSection(panel, section.key) && (section.children?.length ?? 0) === 0, [panel, section]);

  const handleSave = async () => {
    const parsedColumns = Math.max(1, Math.min(4, Number(columns) || 2));
    setSaving(true);
    setError(null);
    try {
      if (tabKey && tabKey !== getSectionParentKey(panel, section.key)) {
        await moveSectionLayout(panel, section, tabKey);
      }
      await saveSectionLayoutSettings(panel, panel.getSection(section.key), {
        label: label.trim(),
        hidden,
        hideLabel,
        columns: parsedColumns,
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
          Section
        </div>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
          {section.key}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Label
        </label>
        <Input value={label} onChange={setLabel} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tab
        </label>
        <Select
          value={tabKey}
          onChange={v => setTabKey(String(v))}
          options={panel.tabs.map(tab => ({ value: tab.key, label: tab.getLabel() || tab.key }))}
        />
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
        <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => DrawerService.push(new AddFieldDesigner(panel, section))}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Add Field
        </button>
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
        <button
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await moveSectionLayout(panel, section, getSectionParentKey(panel, section.key), "up");
            } catch (err: any) {
              setError(err?.message || "Move failed");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Move Up
        </button>
        <button
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await moveSectionLayout(panel, section, getSectionParentKey(panel, section.key), "down");
            } catch (err: any) {
              setError(err?.message || "Move failed");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          style={{
            padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg-surface-alt)", color: "var(--text-primary)", cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          Move Down
        </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
        {canRemove && (
        <button
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await removeSectionLayout(panel, section);
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
