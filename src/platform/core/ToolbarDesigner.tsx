// ToolbarDesigner.tsx — Toolbar configuration designer.
// The single authority for toolbar button configuration.
//
// Two roles:
//   1. applyToolbarDefaults(toolbar) — called by PanelToolbar on mount to
//      apply saved overrides from form_toolbar_actions. The toolbar doesn't
//      know about the DB, it just asks the designer to do its thing.
//   2. ToolbarDesigner instance — pushed onto DrawerService for the admin UI.
//      On save, writes to DB and applies to the live toolbar immediately.

import type { ReactNode } from "react";
import type { ToolbarDef, ButtonDef } from "./ToolbarDef";
import { DrawerService } from "./DrawerService";

// ═══════════════════════════════════════════════════════════════════════
// Identity + apply
// ═══════════════════════════════════════════════════════════════════════

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
}

// Built-in key → ToolbarDef toggle mapping
const BUILTIN_TOGGLE: Record<string, keyof ToolbarDef> = {
  new:    "useNew",
  save:   "useSave",
  delete: "useDelete",
  copy:   "useCopy",
  audit:  "useAudit",
  notes:  "useNotes",
  print:  "usePrint",
};

/** Apply saved toolbar overrides. Called by PanelToolbar on mount. */
export async function applyToolbarDefaults(toolbar: ToolbarDef): Promise<void> {
  if (typeof window === "undefined") return;
  const id = getToolbarId(toolbar);
  if (!id) return;

  try {
    const res  = await fetch(`/api/toolbar-actions?form_key=${encodeURIComponent(id.formKey)}&table_name=${encodeURIComponent(id.gridKey)}`);
    const data = await res.json();
    if (!Array.isArray(data.rows) || data.rows.length === 0) return;
    applyToToolbar(toolbar, data.rows);
  } catch {
    // No saved overrides — toolbar uses code-defined defaults
  }
}

/** Apply DB rows to a toolbar instance. */
function applyToToolbar(toolbar: ToolbarDef, rows: DbButton[]): void {
  for (const row of rows) {
    // Builtin toggles
    const toggle = BUILTIN_TOGGLE[row.action_key];
    if (toggle) {
      (toolbar as any)[toggle] = !row.is_hidden;
      continue;
    }
    // Custom buttons already in toolbar.buttons — update hidden
    const existing = toolbar.buttons.find(b => b.key === row.action_key);
    if (existing) {
      existing.hidden = row.is_hidden;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ToolbarDesigner class — the drawer UI
// ═══════════════════════════════════════════════════════════════════════

export class ToolbarDesigner {
  title = "Toolbar Designer";

  constructor(public toolbar: ToolbarDef) {}

  get id(): ToolbarIdentity | null { return getToolbarId(this.toolbar); }

  show(): ReactNode {
    return <ToolbarDesignerPanel designer={this} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// React component
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/icons/Icon";

interface DesignButton {
  key: string;
  label: string;
  icon: string;
  isBuiltin: boolean;
  visible: boolean;
  sortOrder: number;
}

const BUILTIN_BUTTONS: { key: string; label: string; icon: string; toggle: keyof ToolbarDef }[] = [
  { key: "new",    label: "New",    icon: "plus",           toggle: "useNew" },
  { key: "save",   label: "Save",   icon: "save",           toggle: "useSave" },
  { key: "copy",   label: "Copy",   icon: "copy",           toggle: "useCopy" },
  { key: "delete", label: "Delete", icon: "trash",          toggle: "useDelete" },
  { key: "audit",  label: "Audit",  icon: "shield",         toggle: "useAudit" },
  { key: "notes",  label: "Notes",  icon: "messageSquare",  toggle: "useNotes" },
];

function ToolbarDesignerPanel({ designer }: { designer: ToolbarDesigner }) {
  const toolbar = designer.toolbar;
  const id = designer.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Build initial button list from toolbar state
  const [buttons, setButtons] = useState<DesignButton[]>(() => {
    const builtins: DesignButton[] = BUILTIN_BUTTONS.map((b, i) => ({
      key: b.key,
      label: b.label,
      icon: b.icon,
      isBuiltin: true,
      visible: !!(toolbar as any)[b.toggle],
      sortOrder: (i + 1) * 10,
    }));

    const custom: DesignButton[] = toolbar.buttons.map((b: ButtonDef, i: number) => ({
      key: b.key,
      label: typeof b.label === "string" ? b.label : b.key,
      icon: b.icon ?? "bolt",
      isBuiltin: false,
      visible: !b.hidden,
      sortOrder: 100 + i * 10,
    }));

    return [...builtins, ...custom];
  });

  // Load DB overrides on mount
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/toolbar-actions?form_key=${encodeURIComponent(id.formKey)}&table_name=${encodeURIComponent(id.gridKey)}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.rows) && data.rows.length > 0) {
          const dbMap = new Map<string, DbButton>(data.rows.map((r: DbButton) => [r.action_key, r]));
          setButtons(prev => prev.map(b => {
            const db = dbMap.get(b.key);
            if (!db) return b;
            return { ...b, visible: !db.is_hidden, sortOrder: db.sort_order, label: db.label || b.label, icon: db.icon || b.icon };
          }));
        }
      })
      .catch(() => setError("Failed to load toolbar settings"))
      .finally(() => setLoading(false));
  }, [id?.formKey, id?.gridKey]);

  const toggleVisible = (key: string) => {
    setButtons(prev => prev.map(b => b.key === key ? { ...b, visible: !b.visible } : b));
  };

  // Move button up/down
  const move = (key: string, dir: -1 | 1) => {
    setButtons(prev => {
      const idx = prev.findIndex(b => b.key === key);
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      // Reassign sort orders
      return next.map((b, i) => ({ ...b, sortOrder: (i + 1) * 10 }));
    });
  };

  // Save — write to DB, apply to live toolbar, refresh, close
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        form_key: id.formKey,
        table_name: id.gridKey,
        buttons: buttons.map(b => ({
          action_key:  b.key,
          label:       b.label,
          icon:        b.icon,
          variant:     "default",
          separator:   false,
          is_hidden:   !b.visible,
          sort_order:  b.sortOrder,
          is_standard: b.isBuiltin,
          handler:     "",
        })),
      };

      const res = await fetch("/api/toolbar-actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");

      // Apply to live toolbar
      applyToToolbar(toolbar, payload.buttons as any);
      toolbar.refresh();

      DrawerService.pop();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => DrawerService.pop();

  // ── Styles ────────────────────────────────────────────────────────
  const sectionTitle: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--text-muted)", padding: "12px 16px 6px",
  };

  const divider: React.CSSProperties = { height: 1, background: "var(--border)", margin: "4px 0" };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Loading...
      </div>
    );
  }

  const visibleCount = buttons.filter(b => b.visible).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Fixed top ─────────────────────────────────────────── */}
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
      </div>

      {/* ── Button list (scrollable) ─────────────────────────── */}
      <div style={{ flex: 1, margin: "0 10px", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 50px 60px",
          padding: "4px 12px", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface-alt)", flexShrink: 0,
        }}>
          <span>Order</span>
          <span>Button</span>
          <span style={{ textAlign: "center" }}>Show</span>
          <span />
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {buttons.map((btn, i) => (
            <div key={btn.key} style={{
              display: "grid", gridTemplateColumns: "40px 1fr 50px 60px",
              alignItems: "center", padding: "6px 12px", fontSize: "0.8rem",
              color: btn.visible ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: "1px solid var(--border-light, rgba(0,0,0,0.04))",
              opacity: btn.visible ? 1 : 0.5,
            }}>
              {/* Sort order number */}
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{btn.sortOrder}</span>

              {/* Icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name={btn.icon} size={14} />
                <span>{btn.label}</span>
                {!btn.isBuiltin && (
                  <span style={{ fontSize: "0.6rem", color: "var(--accent)", padding: "1px 5px", borderRadius: 3, background: "var(--accent-light, rgba(14,134,202,0.08))" }}>
                    custom
                  </span>
                )}
              </div>

              {/* Visible toggle */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Toggle value={btn.visible} onChange={() => toggleVisible(btn.key)} size="sm" />
              </div>

              {/* Move up/down */}
              <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                <button
                  onClick={() => move(btn.key, -1)}
                  disabled={i === 0}
                  style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.2 : 0.6, padding: 2, display: "flex", color: "var(--text-muted)" }}
                >
                  <Icon name="chevUp" size={12} />
                </button>
                <button
                  onClick={() => move(btn.key, 1)}
                  disabled={i === buttons.length - 1}
                  style={{ background: "none", border: "none", cursor: i === buttons.length - 1 ? "default" : "pointer", opacity: i === buttons.length - 1 ? 0.2 : 0.6, padding: 2, display: "flex", color: "var(--text-muted)" }}
                >
                  <Icon name="chevDown" size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
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
