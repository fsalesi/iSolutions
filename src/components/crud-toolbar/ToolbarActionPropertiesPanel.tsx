"use client";
import { useState, useEffect, useRef } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Field, Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/icons/Icon";
import type { DesignAction, DbToolbarAction } from "./useToolbarActions";

const VARIANT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "primary", label: "Primary (blue)" },
  { value: "danger",  label: "Danger (red)" },
];

const STANDARD_KEYS = new Set(["save", "new", "delete", "copy"]);

// All available icon names — keep in sync with Icon.tsx ICON_PATHS
const ALL_ICONS = [
  "activity", "arrowLeft", "ban", "bell", "briefcase", "camera", "chart",
  "check", "chevDown", "chevFirst", "chevLast", "chevLeft", "chevRight", "chevUp",
  "clock", "collapse", "columns", "copy", "download", "edit", "expand",
  "filter", "globe", "key", "list", "lock", "logOut", "mail", "menu",
  "messageSquare", "moon", "plus", "rotate-ccw", "save", "search", "server",
  "settings", "shield", "sortAsc", "sortDesc", "sun", "tag", "trash",
  "undo", "unlock", "upload", "user", "users", "x",
];

// ─── Icon Picker ──────────────────────────────────────────────────────────────
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = filter
    ? ALL_ICONS.filter(n => n.toLowerCase().includes(filter.toLowerCase()))
    : ALL_ICONS;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: 13,
          textAlign: "left",
        }}
      >
        {value ? (
          <>
            <Icon name={value} size={16} />
            <span style={{ flex: 1 }}>{value}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: "var(--text-muted)" }}>— none —</span>
        )}
        <Icon name="chevDown" size={14} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          zIndex: 1000,
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
            <Input value={filter} onChange={setFilter} placeholder="Search icons…" />
          </div>

          {/* None option */}
          <div style={{ padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setFilter(""); }}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 8px",
                borderRadius: 5,
                border: "none",
                background: value === "" ? "var(--accent-subtle)" : "transparent",
                color: "var(--text-muted)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              — none —
            </button>
          </div>

          {/* Icon grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 2,
            padding: 6,
            maxHeight: 240,
            overflowY: "auto",
          }}>
            {filtered.map(name => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => { onChange(name); setOpen(false); setFilter(""); }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 4px",
                  borderRadius: 6,
                  border: name === value ? "1px solid var(--accent)" : "1px solid transparent",
                  background: name === value ? "var(--accent-subtle)" : "transparent",
                  color: name === value ? "var(--accent)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontSize: 9,
                  overflow: "hidden",
                }}
              >
                <Icon name={name} size={16} />
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1/-1", padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No icons match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <SlidePanel open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 20px" }}>

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
    </SlidePanel>
  );
}
