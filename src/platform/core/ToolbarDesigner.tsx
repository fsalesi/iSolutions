// ToolbarDesigner.tsx — Toolbar configuration designer.
// The single authority for toolbar button configuration.

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  ToolbarDef,
  ButtonDef,
  ToolbarButtonHandlerOption,
  ToolbarButtonSettings,
} from "./ToolbarDef";
import { getToolbarButtonHandlerOptions } from "./ToolbarDef";
import { DrawerService } from "./DrawerService";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/icons/Icon";
import { IconPicker } from "@/components/ui/IconPicker";

interface ToolbarIdentity { formKey: string; gridKey: string; }

function getToolbarId(toolbar: ToolbarDef): ToolbarIdentity | null {
  const formKey = toolbar.panel?.form?.formKey ?? "";
  const gridKey = toolbar.panel?.grid?.key ?? "";
  if (!formKey || !gridKey) return null;
  return { formKey, gridKey };
}

interface DbButton {
  action_key: string;
  label: string;
  icon: string;
  variant: string;
  separator: boolean;
  is_hidden: boolean;
  sort_order: number;
  is_standard: boolean;
  handler: string;
  settings?: ToolbarButtonSettings | null;
}

interface DesignButton {
  key: string;
  label: string;
  icon: string;
  handler: string;
  settings: ToolbarButtonSettings;
  origin: "builtin" | "code" | "db";
  isBuiltin: boolean;
  visible: boolean;
  sortOrder: number;
}

const BUILTIN_TOGGLE: Record<string, keyof ToolbarDef> = {
  new: "useNew",
  save: "useSave",
  delete: "useDelete",
  copy: "useCopy",
  audit: "useAudit",
  notes: "useNotes",
  print: "usePrint",
};

const BUILTIN_BUTTONS: { key: string; label: string; icon: string; toggle: keyof ToolbarDef }[] = [
  { key: "new",    label: "New",    icon: "plus",          toggle: "useNew" },
  { key: "save",   label: "Save",   icon: "save",          toggle: "useSave" },
  { key: "copy",   label: "Copy",   icon: "copy",          toggle: "useCopy" },
  { key: "delete", label: "Delete", icon: "trash",         toggle: "useDelete" },
  { key: "audit",  label: "Audit",  icon: "shield",        toggle: "useAudit" },
  { key: "notes",  label: "Notes",  icon: "messageSquare", toggle: "useNotes" },
];

function toDesignButton(row: DbButton): DesignButton {
  return {
    key: row.action_key,
    label: row.label || row.action_key,
    icon: row.icon || "bolt",
    handler: row.handler || "",
    settings: row.settings ?? {},
    origin: row.is_standard ? "builtin" : "db",
    isBuiltin: !!row.is_standard,
    visible: !row.is_hidden,
    sortOrder: row.sort_order || 10,
  };
}

function sortButtons(buttons: DesignButton[]): DesignButton[] {
  return [...buttons].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.key.localeCompare(b.key);
  });
}

function slugifyActionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "custom_button";
}

function createCustomKey(existing: DesignButton[], label: string): string {
  const base = slugifyActionKey(label);
  const keys = new Set(existing.map(button => button.key));
  if (!keys.has(base)) return base;
  let index = 2;
  while (keys.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function getDefaultButtons(toolbar: ToolbarDef): DesignButton[] {
  const builtins: DesignButton[] = BUILTIN_BUTTONS.map((button, index) => ({
    key: button.key,
    label: button.label,
    icon: button.icon,
    handler: "",
    settings: {},
    origin: "builtin",
    isBuiltin: true,
    visible: !!(toolbar as ToolbarDef & Record<string, boolean>)[button.toggle],
    sortOrder: (index + 1) * 10,
  }));

  const custom: DesignButton[] = toolbar.buttons.map((button: ButtonDef, index: number) => ({
    key: button.key,
    label: typeof button.label === "string" ? button.label : button.key,
    icon: button.icon ?? "bolt",
    handler: button.handler ?? "",
    settings: button.settings ?? {},
    origin: "code",
    isBuiltin: false,
    visible: !button.hidden,
    sortOrder: button.sortOrder ?? (100 + index * 10),
  }));

  return sortButtons([...builtins, ...custom]);
}

function appendMissingRows(existing: DesignButton[], rows: DbButton[]): DesignButton[] {
  const byKey = new Map(existing.map(button => [button.key, button]));

  for (const row of rows) {
    const next = toDesignButton(row);
    const current = byKey.get(next.key);
    if (current) byKey.set(next.key, { ...current, ...next, origin: current.origin === "code" ? "code" : next.origin });
    else byKey.set(next.key, next);
  }

  return sortButtons(Array.from(byKey.values()));
}

function getInitialHandler(handlerOptions: ToolbarButtonHandlerOption[]): string {
  return handlerOptions[0]?.key ?? "";
}

async function fetchToolbarRows(id: ToolbarIdentity): Promise<DbButton[]> {
  const res = await fetch(`/api/toolbar-actions?form_key=${encodeURIComponent(id.formKey)}&table_name=${encodeURIComponent(id.gridKey)}`);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data && typeof data.error === "string" ? data.error : `Toolbar settings request failed (${res.status})`;
    throw new Error(message);
  }

  return Array.isArray(data?.rows) ? data.rows as DbButton[] : [];
}

/** Apply saved toolbar overrides. Called by PanelToolbar on mount. */
export async function applyToolbarDefaults(toolbar: ToolbarDef): Promise<void> {
  if (typeof window === "undefined") return;
  const id = getToolbarId(toolbar);
  if (!id) return;

  try {
    const rows = await fetchToolbarRows(id);
    if (rows.length === 0) return;
    applyToToolbar(toolbar, rows);
  } catch (error) {
    console.warn("Toolbar settings could not be loaded; using defaults.", error);
  }
}

/** Apply DB rows to a toolbar instance. */
function applyToToolbar(toolbar: ToolbarDef, rows: DbButton[]): void {
  const currentDbKeys = new Set<string>();
  const previousDbKeys = new Set<string>((toolbar as any)._dbButtonKeys ?? []);

  for (const row of rows) {
    const toggle = BUILTIN_TOGGLE[row.action_key];
    if (toggle) {
      (toolbar as ToolbarDef & Record<string, boolean>)[toggle] = !row.is_hidden;
      toolbar.buttonSortOrder[row.action_key] = row.sort_order || toolbar.buttonSortOrder[row.action_key] || 10;
      continue;
    }

    currentDbKeys.add(row.action_key);
    const existing = toolbar.buttons.find(button => button.key === row.action_key);
    const target = existing ?? {
      key: row.action_key,
      label: row.label || row.action_key,
      icon: row.icon || "bolt",
      hidden: row.is_hidden,
      handler: row.handler || "",
      settings: row.settings ?? {},
    };

    target.label = row.label || target.label;
    target.icon = row.icon || target.icon;
    target.hidden = row.is_hidden;
    target.handler = row.handler || target.handler;
    target.settings = row.settings ?? target.settings ?? {};
    target.requiresRecord = !!target.settings?.requiresRecord;
    target.disabledWhenNew = !!target.settings?.disabledWhenNew;
    target.disabledWhenDirty = !!target.settings?.disabledWhenDirty;
    target.disabledWhenReadOnly = !!target.settings?.disabledWhenReadOnly;
    target.hiddenWhenReadOnly = !!target.settings?.hiddenWhenReadOnly;
    target.sortOrder = row.sort_order || target.sortOrder;

    if (!existing) toolbar.addButton(target);
  }

  for (const key of previousDbKeys) {
    if (!currentDbKeys.has(key)) toolbar.removeButton(key);
  }

  (toolbar as any)._dbButtonKeys = Array.from(currentDbKeys);
}

export class ToolbarDesigner {
  title = "Toolbar Designer";

  constructor(public toolbar: ToolbarDef) {}

  get id(): ToolbarIdentity | null { return getToolbarId(this.toolbar); }

  show(): ReactNode {
    return <ToolbarDesignerPanel designer={this} />;
  }
}

function ToolbarDesignerPanel({ designer }: { designer: ToolbarDesigner }) {
  const toolbar = designer.toolbar;
  const id = designer.id;
  const formKey = id?.formKey ?? "";
  const form = toolbar.panel?.form ?? null;

  const handlerOptions = useMemo(
    () => getToolbarButtonHandlerOptions(form),
    [form]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buttons, setButtons] = useState<DesignButton[]>(() => getDefaultButtons(toolbar));
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("bolt");
  const [newHandler, setNewHandler] = useState(() => getInitialHandler(handlerOptions));

  useEffect(() => {
    if (!newHandler && handlerOptions.length > 0) setNewHandler(handlerOptions[0].key);
  }, [handlerOptions, newHandler]);

  useEffect(() => {
    if (!id) {
      setButtons(getDefaultButtons(toolbar));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchToolbarRows(id)
      .then(rows => {
        if (cancelled) return;
        if (rows.length === 0) {
          setButtons(getDefaultButtons(toolbar));
          return;
        }
        setButtons(prev => appendMissingRows(prev, rows));
      })
      .catch(error => {
        if (cancelled) return;
        console.warn("Toolbar settings could not be loaded in designer; using defaults.", error);
        setButtons(getDefaultButtons(toolbar));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id?.formKey, id?.gridKey, toolbar]);

  useEffect(() => {
    if (!buttons.length) {
      setSelectedKey("");
      return;
    }
    if (!selectedKey || !buttons.some(button => button.key === selectedKey)) {
      const firstCustom = buttons.find(button => !button.isBuiltin);
      setSelectedKey(firstCustom?.key ?? buttons[0].key);
    }
  }, [buttons, selectedKey]);

  const selectedButton = buttons.find(button => button.key === selectedKey) ?? null;
  const visibleCount = buttons.filter(button => button.visible).length;

  const setButtonPatch = (key: string, patch: Partial<DesignButton>) => {
    setButtons(prev => prev.map(button => button.key === key ? { ...button, ...patch } : button));
  };

  const toggleVisible = (key: string) => {
    setButtons(prev => prev.map(button => button.key === key ? { ...button, visible: !button.visible } : button));
  };

  const move = (key: string, dir: -1 | 1) => {
    setButtons(prev => {
      const ordered = sortButtons(prev);
      const index = ordered.findIndex(button => button.key === key);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= ordered.length) return prev;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((button, orderIndex) => ({ ...button, sortOrder: (orderIndex + 1) * 10 }));
    });
  };

  const addCustomButton = () => {
    const label = newLabel.trim();
    const handler = newHandler.trim();
    if (!label) {
      setError("Enter a label for the new button.");
      return;
    }
    if (!handler) {
      setError("Select a handler for the new button.");
      return;
    }

    setButtons(prev => {
      const key = createCustomKey(prev, label);
      const next: DesignButton = {
        key,
        label,
        icon: newIcon || "bolt",
        handler,
        settings: {},
        origin: "db",
        isBuiltin: false,
        visible: true,
        sortOrder: ((prev.length + 1) * 10),
      };
      setSelectedKey(key);
      return sortButtons([...prev, next]).map((button, index) => ({ ...button, sortOrder: (index + 1) * 10 }));
    });

    setNewLabel("");
    setNewIcon("bolt");
    setNewHandler(getInitialHandler(handlerOptions));
    setError(null);
  };

  const removeCustomButton = (key: string) => {
    setButtons(prev => {
      const target = prev.find(button => button.key === key);
      if (!target) return prev;

      if (target.origin === "code") {
        return sortButtons(prev.map(button =>
          button.key === key ? { ...button, visible: false } : button
        )).map((button, index) => ({ ...button, sortOrder: (index + 1) * 10 }));
      }

      return sortButtons(prev.filter(button => button.key !== key)).map((button, index) => ({ ...button, sortOrder: (index + 1) * 10 }));
    });
    setSelectedKey("");
  };

  const handleSave = async () => {
    if (!id) return;
    const invalid = buttons.find(button => !button.isBuiltin && (!button.label.trim() || !button.handler.trim()));
    if (invalid) {
      setError(`Custom button "${invalid.key}" needs both a label and a handler.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ordered = sortButtons(buttons).map((button, index) => ({ ...button, sortOrder: (index + 1) * 10 }));
      const payload = {
        form_key: id.formKey,
        table_name: id.gridKey,
        buttons: ordered.map(button => ({
          action_key: button.key,
          label: button.label,
          icon: button.icon,
          variant: "default",
          separator: false,
          is_hidden: !button.visible,
          sort_order: button.sortOrder,
          is_standard: button.isBuiltin,
          handler: button.isBuiltin ? "" : button.handler,
          settings: button.settings ?? {},
        })),
      };

      const res = await fetch("/api/toolbar-actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");

      applyToToolbar(toolbar, payload.buttons as DbButton[]);
      toolbar.refresh();
      DrawerService.pop();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => DrawerService.pop();

  const sectionTitle: CSSProperties = {
    fontSize: "0.7rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
    padding: "12px 16px 6px",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontSize: "0.82rem",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ padding: "14px 16px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {id ? `${id.formKey}:${id.gridKey}` : "unknown"}
        </div>

        <div style={{ ...sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Buttons</span>
          <span style={{ fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "var(--bg-surface-alt)", color: "var(--text-muted)" }}>
            {visibleCount} of {buttons.length}
          </span>
        </div>

        <div style={{ display: "grid", gap: 10, padding: "0 16px 12px" }}>
          <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-surface-alt)" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600 }}>Add Custom Button</div>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.currentTarget.value)}
              placeholder="Button label"
              style={inputStyle}
            />
            <select value={newHandler} onChange={e => setNewHandler(e.currentTarget.value)} style={inputStyle}>
              <option value="">Select a handler</option>
              {handlerOptions.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Icon</div>
              <IconPicker value={newIcon} onChange={value => setNewIcon(value || "bolt")} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={addCustomButton}
                style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
              >
                Add Button
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: "0.75rem" }}>
                <Icon name={newIcon} size={15} />
                <span>{newIcon}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)", gap: 12, padding: "0 10px 10px" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 50px 60px", padding: "4px 12px", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)", flexShrink: 0 }}>
            <span>Order</span>
            <span>Button</span>
            <span style={{ textAlign: "center" }}>Show</span>
            <span />
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {sortButtons(buttons).map((button, index) => {
              const isSelected = button.key === selectedKey;
              return (
                <div
                  key={button.key}
                  onClick={() => setSelectedKey(button.key)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 50px 60px",
                    alignItems: "center",
                    padding: "6px 12px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    color: button.visible ? "var(--text-primary)" : "var(--text-muted)",
                    borderBottom: "1px solid var(--border-light, rgba(0,0,0,0.04))",
                    opacity: button.visible ? 1 : 0.5,
                    background: isSelected ? "var(--bg-hover, rgba(0,0,0,0.04))" : "transparent",
                  }}
                >
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{button.sortOrder}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Icon name={button.icon} size={14} />
                    <div style={{ display: "grid", minWidth: 0 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{button.label}</span>
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {button.isBuiltin ? button.key : button.handler || button.key}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Toggle value={button.visible} onChange={() => toggleVisible(button.key)} size="sm" />
                  </div>

                  <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                    <button
                      onClick={e => { e.stopPropagation(); move(button.key, -1); }}
                      disabled={index === 0}
                      style={{ background: "none", border: "none", cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.2 : 0.6, padding: 2, display: "flex", color: "var(--text-muted)" }}
                    >
                      <Icon name="chevUp" size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); move(button.key, 1); }}
                      disabled={index === buttons.length - 1}
                      style={{ background: "none", border: "none", cursor: index === buttons.length - 1 ? "default" : "pointer", opacity: index === buttons.length - 1 ? 0.2 : 0.6, padding: 2, display: "flex", color: "var(--text-muted)" }}
                    >
                      <Icon name="chevDown" size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 6, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ ...sectionTitle, paddingTop: 10 }}>Selection</div>

          {!selectedButton && (
            <div style={{ padding: 16, color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Select a button to edit it.
            </div>
          )}

          {selectedButton && selectedButton.isBuiltin && (
            <div style={{ padding: 16, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", fontWeight: 600 }}>
                <Icon name={selectedButton.icon} size={16} />
                <span>{selectedButton.label}</span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Built-in buttons can be shown, hidden, and reordered here. New handlers only apply to custom buttons.
              </div>
            </div>
          )}

          {selectedButton && !selectedButton.isBuiltin && (
            <div style={{ display: "grid", gap: 12, padding: 16, minHeight: 0, overflow: "auto" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Label</label>
                <input
                  value={selectedButton.label}
                  onChange={e => setButtonPatch(selectedButton.key, { label: e.currentTarget.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Handler</label>
                <select
                  value={selectedButton.handler}
                  onChange={e => setButtonPatch(selectedButton.key, { handler: e.currentTarget.value })}
                  style={inputStyle}
                >
                  <option value="">Select a handler</option>
                  {handlerOptions.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {handlerOptions.find(option => option.key === selectedButton.handler)?.description || "Handlers come from the current page override."}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Icon</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: "0.82rem" }}>
                    <Icon name={selectedButton.icon} size={16} />
                    <span>{selectedButton.icon}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomButton(selectedButton.key)}
                  style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--danger-border, #fc8181)", background: "transparent", color: "var(--danger, #e53e3e)", fontSize: "0.78rem", cursor: "pointer" }}
                >
{selectedButton.origin === "code" ? "Hide Button" : "Remove Button"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Icon</label>
                <IconPicker value={selectedButton.icon} onChange={value => setButtonPatch(selectedButton.key, { icon: value || "bolt" })} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>State Rules</label>
                {[
                  ["requiresRecord", "Requires selected record"],
                  ["disabledWhenNew", "Disable on new record"],
                  ["disabledWhenDirty", "Disable when panel is dirty"],
                  ["disabledWhenReadOnly", "Disable when panel is read-only"],
                  ["hiddenWhenReadOnly", "Hide when panel is read-only"],
                ].map(([settingKey, settingLabel]) => (
                  <label
                    key={settingKey}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-primary)", fontSize: "0.78rem" }}
                  >
                    <span>{settingLabel}</span>
                    <Toggle
                      value={!!selectedButton.settings[settingKey as keyof ToolbarButtonSettings]}
                      onChange={value => setButtonPatch(selectedButton.key, {
                        settings: {
                          ...selectedButton.settings,
                          [settingKey]: !!value,
                        },
                      })}
                      size="sm"
                    />
                  </label>
                ))}
                <div style={{ padding: "9px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface-alt)", color: "var(--text-muted)", fontSize: "0.76rem" }}>
                  These rules are saved into <code>settings</code> and evaluated against the current panel state.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-surface-alt)", flexShrink: 0 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--danger-text, #dc2626)" }}>{error || ""}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleCancel} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "0.8rem", cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#fff", fontSize: "0.8rem", fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
