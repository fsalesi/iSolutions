"use client";
import { useState, useEffect, useRef } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Field, Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/icons/Icon";
import { IconPicker } from "@/components/ui/IconPicker";
import type { DesignAction, DbToolbarAction } from "./useToolbarActions";
import { TranslationsSection } from "@/components/pages/FormPage/panels/TranslationsSection";

const VARIANT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "primary", label: "Primary (blue)" },
  { value: "danger",  label: "Danger (red)" },
];

const STANDARD_KEYS = new Set(["save", "new", "delete", "copy"]);

const PANEL_TABS = [
  { key: "properties", label: "Properties" },
  { key: "translations", label: "Translations" },
];

// ─── Main component ────────────────────────────────────────────────────────────
type Props = {
  action: DesignAction | null;
  open: boolean;
  formKey: string;
  tableName: string;
  onClose: () => void;
  onSaved: (db: DbToolbarAction) => void;
  onDeleted: (actionKey: string) => void;
  addMode?: boolean;
};

export function ToolbarActionPropertiesPanel({
  action, open, formKey, tableName, onClose, onSaved, onDeleted, addMode,
}: Props) {
  const isStandard = action ? STANDARD_KEYS.has(action.key) : false;
  const canDelete = action ? (!isStandard && !!action._oid) : false;

  const [label,     setLabel]     = useState("");
  const [icon,      setIcon]      = useState("");
  const [variant,   setVariant]   = useState("default");
  const [separator, setSeparator] = useState<boolean | null>(false);
  const [isHidden,  setIsHidden]  = useState<boolean | null>(false);
  const [sortOrder, setSortOrder] = useState("10");
  const [actionKey, setActionKey] = useState("");
  const [activeTab, setActiveTab] = useState("properties");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!open) return;
    if (addMode) {
      setLabel(""); setIcon(""); setVariant("default");
      setSeparator(false); setIsHidden(false); setSortOrder("100"); setActionKey("");
    } else if (action) {
      setLabel(action.label || "");
      setIcon(action.icon || "");
      setVariant(action.variant || "default");
      setSeparator(action.separator ?? false);
      setIsHidden(action._isHidden ?? false);
      setSortOrder(String(action._sortOrder ?? 10));
      setActionKey(action.key || "");
    }
    setError("");
    setActiveTab("properties");
  }, [open, action, addMode]);

  const handleSave = async () => {
    if (!label.trim()) { setError("Label is required"); return; }
    if (addMode && !actionKey.trim()) { setError("Action key is required"); return; }
    setSaving(true); setError("");
    try {
      const key = addMode ? actionKey.trim() : action!.key;
      const oid = action?._oid;
      let res: Response;
      if (oid && !addMode) {
        res = await fetch("/api/form_toolbar_actions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oid, label, icon, variant, separator: !!separator, is_hidden: !!isHidden, sort_order: Number(sortOrder) || 10 }),
        });
      } else {
        res = await fetch("/api/form_toolbar_actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_key: formKey, table_name: tableName,
            action_key: key, label, icon, variant,
            separator: !!separator, is_hidden: !!isHidden, sort_order: Number(sortOrder) || 10,
            is_standard: isStandard,
          }),
        });
      }
      if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!action?._oid) return;
    setDeleting(true);
    try {
      await fetch(`/api/form_toolbar_actions?oid=${action._oid}`, { method: "DELETE" });
      onDeleted(action.key);
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  };

  const title = addMode ? "Add Toolbar Button" : `Edit Button: ${action?.label || action?.key}`;

  return (
    <SlidePanel open={open} onClose={onClose} title={title}
      tabs={!addMode ? PANEL_TABS : undefined}
      activeTab={activeTab} onTabChange={setActiveTab}>
      <div style={{ padding: "16px 20px" }}>
        {activeTab === "translations" && !addMode && (
          <TranslationsSection formKey={formKey} layoutKey={action?.key || ""} />
        )}
        {(activeTab === "properties" || addMode) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {addMode && (
          <Field label="Action Key">
            <Input
              value={actionKey}
              onChange={v => setActionKey(v.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="my-action"
            />
          </Field>
        )}

        <Field label="Label">
          <Input value={label} onChange={setLabel} placeholder="Button label" />
        </Field>

        <Field label="Icon">
          <IconPicker value={icon} onChange={setIcon} />
        </Field>

        <Field label="Variant">
          <Select value={variant} onChange={setVariant} options={VARIANT_OPTIONS} />
        </Field>

        <Field label="Sort Order">
          <Input type="number" value={sortOrder} onChange={setSortOrder} style={{ width: 80 }} />
        </Field>

        <Field label="Separator before this button">
          <Toggle value={separator} onChange={setSeparator} />
        </Field>

        <Field label="Hidden">
          <Toggle value={isHidden} onChange={setIsHidden} />
        </Field>

        {error && (
          <div style={{ color: "var(--danger-text)", fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md"
            style={{ background: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md"
            style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}
          >
            Cancel
          </button>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md ml-auto"
              style={{ background: "transparent", color: "var(--danger-text)", border: "1px solid var(--danger-border)", cursor: deleting ? "wait" : "pointer" }}
            >
              {deleting ? "Deleting…" : "Delete Button"}
            </button>
          )}
        </div>
        </div>
        )}
      </div>
    </SlidePanel>
  );
}
