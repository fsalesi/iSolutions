// GridDesigner.tsx — Grid configuration designer.
// The single authority for grid configuration.
// 
// Two roles:
//   1. GridDesigner.apply(grid) — called by DataGridDef.loadColumns() to apply
//      saved settings from grid_defaults. The grid doesn't know about the DB,
//      it just asks the designer to do its thing.
//   2. GridDesigner instance — pushed onto DrawerService for the admin UI.
//      On save, writes to DB and applies to the live grid immediately.

import type { ReactNode } from "react";
import type { DataGridDef } from "./DataGridDef";
import { DrawerService } from "./DrawerService";

/** Compute the grid_id for the grid_defaults table. */
function getGridId(grid: DataGridDef): string {
  const formKey = (grid.form as any)?.formKey ?? "";
  const gridKey = grid.key;
  return `${formKey}:${gridKey}`;
}

/** Apply saved grid_defaults settings to a grid. Called from DataGridDef.loadColumns(). */
export async function applyGridDefaults(grid: DataGridDef): Promise<void> {
  if (typeof window === "undefined") return;  // SSR guard
  const gridId = getGridId(grid);
  if (!gridId) return;

  try {
    const res  = await fetch(`/api/grid-defaults?grid=${encodeURIComponent(gridId)}`);
    const data = await res.json();
    applyToGrid(grid, data);
  } catch {
    // No saved defaults — grid uses its code-defined defaults
  }
}

/** Apply a settings payload to a grid instance. */
function applyToGrid(grid: DataGridDef, data: any): void {
  if (!data) return;
  const settings = data.settings ?? {};

  // Chrome flags
  if (settings.showToolbar          !== undefined) grid.showToolbar          = !!settings.showToolbar;
  if (settings.allowSearch          !== undefined) grid.allowSearch          = !!settings.allowSearch;
  if (settings.allowAdvancedFilter  !== undefined) grid.allowAdvancedFilter  = !!settings.allowAdvancedFilter;
  if (settings.allowExcelExport     !== undefined) grid.allowExcelExport     = !!settings.allowExcelExport;
  if (settings.allowColumnChanger   !== undefined) grid.allowColumnChanger   = !!settings.allowColumnChanger;
  if (settings.showFooter           !== undefined) grid.showFooter           = !!settings.showFooter;

  // Default sort
  if (settings.sortKey) {
    grid.sort          = [settings.sortKey];
    grid.sortDirection = [settings.sortDir || "ASC"];
  }

  // Column visibility — default_keys are the columns that should be visible
  if (Array.isArray(data.default_keys) && data.default_keys.length > 0) {
    const defaultSet = new Set(data.default_keys);
    for (const col of grid.columns) {
      col.hidden = !defaultSet.has(col.key);
    }
  }

  // Allowed keys — stored on grid for the column picker to respect
  if (Array.isArray(data.allowed_keys)) {
    (grid as any)._allowedKeys = data.allowed_keys;
  } else {
    (grid as any)._allowedKeys = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GridDesigner class — the drawer UI
// ═══════════════════════════════════════════════════════════════════════

export class GridDesigner {
  title = "Grid Designer";

  constructor(public grid: DataGridDef) {}

  get gridId(): string { return getGridId(this.grid); }

  show(): ReactNode {
    return <GridDesignerPanel designer={this} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// React component — owns all local state for the designer UI
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { resolveClientText } from "@/lib/i18n/runtime";

interface ChromeFlag {
  key: string;
  label: string;
  value: boolean;
}

interface ColumnEntry {
  key: string;
  label: string;
  allowed: boolean;
  default: boolean;
}

function GridDesignerPanel({ designer }: { designer: GridDesigner }) {
  const grid = designer.grid;
  const gridId = designer.gridId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Chrome flags ──────────────────────────────────────────────────
  // Top-level flags
  const [showToolbar, setShowToolbar] = useState(grid.showToolbar);
  const [showFooter, setShowFooter]   = useState(grid.showFooter);

  // Toolbar sub-items — only meaningful when toolbar is on
  const [toolbarFlags, setToolbarFlags] = useState<ChromeFlag[]>([
    { key: "allowSearch",          label: "Search",           value: grid.allowSearch },
    { key: "allowAdvancedFilter",  label: "Filter",           value: grid.allowAdvancedFilter },
    { key: "allowExcelExport",     label: "Export to Excel",  value: grid.allowExcelExport },
    { key: "allowColumnChanger",   label: "Column Chooser",   value: grid.allowColumnChanger },
  ]);

  const toggleToolbarFlag = (key: string) => {
    setToolbarFlags(prev => prev.map(f => f.key === key ? { ...f, value: !f.value } : f));
  };

  // ── Unrestricted mode ─────────────────────────────────────────────
  const [unrestricted, setUnrestricted] = useState(true);

  // ── Column allowed + default ──────────────────────────────────────
  const [columns, setColumns] = useState<ColumnEntry[]>(() =>
    grid.columns.map(c => ({
      key:     c.key,
      label:   (typeof c.label === "string" ? c.label : resolveClientText(c.label)) || c.key,
      allowed: true,
      default: !c.hidden,
    }))
  );

  const toggleAllowed = (key: string) => {
    setColumns(prev => prev.map(c => {
      if (c.key !== key) return c;
      const newAllowed = !c.allowed;
      return { ...c, allowed: newAllowed, default: newAllowed ? c.default : false };
    }));
  };

  const toggleDefault = (key: string) => {
    setColumns(prev => prev.map(c => {
      if (c.key !== key) return c;
      if (!unrestricted && !c.allowed) return c;
      return { ...c, default: !c.default };
    }));
  };

  const handleUnrestrictedChange = (val: boolean) => {
    setUnrestricted(val);
    if (val) {
      setColumns(prev => prev.map(c => ({ ...c, allowed: true })));
    }
  };

  // ── Default sort ──────────────────────────────────────────────────
  const [sortKey, setSortKey]   = useState(grid.sort[0] || "");
  const [sortDir, setSortDir]   = useState<"ASC" | "DESC">(grid.sortDirection[0] || "ASC");

  // ── Load on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/grid-defaults?grid=${encodeURIComponent(gridId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.settings && typeof data.settings === "object") {
          if (data.settings.showToolbar !== undefined) setShowToolbar(!!data.settings.showToolbar);
          if (data.settings.showFooter  !== undefined) setShowFooter(!!data.settings.showFooter);
          setToolbarFlags(prev => prev.map(f => {
            const val = data.settings[f.key];
            return val !== undefined ? { ...f, value: !!val } : f;
          }));
        }

        if (Array.isArray(data.allowed_keys)) {
          setUnrestricted(false);
          const allowedSet = new Set(data.allowed_keys);
          setColumns(prev => prev.map(c => ({
            ...c,
            allowed: allowedSet.has(c.key),
            default: Array.isArray(data.default_keys)
              ? data.default_keys.includes(c.key)
              : c.default,
          })));
        } else {
          setUnrestricted(true);
          if (Array.isArray(data.default_keys) && data.default_keys.length > 0) {
            const defaultSet = new Set(data.default_keys);
            setColumns(prev => prev.map(c => ({ ...c, allowed: true, default: defaultSet.has(c.key) })));
          }
        }

        if (data.settings?.sortKey) setSortKey(data.settings.sortKey);
        if (data.settings?.sortDir) setSortDir(data.settings.sortDir);
      })
      .catch(() => setError("Failed to load grid settings"))
      .finally(() => setLoading(false));
  }, [gridId]);

  // ── Save — write to DB, apply to live grid, refresh, close ────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const defaultKeys = columns.filter(c => c.default).map(c => c.key);
      const allowedKeys = unrestricted ? null : columns.filter(c => c.allowed).map(c => c.key);

      const settings: Record<string, any> = {};
      settings.showToolbar = showToolbar;
      for (const f of toolbarFlags) settings[f.key] = f.value;
      settings.showFooter = showFooter;
      if (sortKey) {
        settings.sortKey = sortKey;
        settings.sortDir = sortDir;
      }

      const payload = { grid_id: gridId, default_keys: defaultKeys, allowed_keys: allowedKeys, settings };

      // 1. Save to database
      const res = await fetch("/api/grid-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");

      // 2. Apply to the live grid immediately
      applyToGrid(grid, payload);

      // 3. Refresh the grid so changes are visible
      grid.onFetch?.();

      // 4. Close the drawer
      DrawerService.pop();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => DrawerService.pop();

  // ── Counts ────────────────────────────────────────────────────────
  const allowedCount = columns.filter(c => c.allowed).length;
  const defaultCount = columns.filter(c => c.default).length;

  // ── Styles ────────────────────────────────────────────────────────
  const sectionTitle: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "var(--text-muted)", padding: "12px 16px 6px",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "7px 16px", fontSize: "0.82rem", color: "var(--text-primary)",
  };

  const divider: React.CSSProperties = { height: 1, background: "var(--border)", margin: "4px 0" };

  const pill: React.CSSProperties = {
    fontSize: "0.65rem", fontWeight: 600, padding: "2px 8px", borderRadius: 10,
    background: "var(--bg-surface-alt)", color: "var(--text-muted)", marginLeft: 6,
  };

  const checkbox = (checked: boolean, enabled: boolean = true): React.CSSProperties => ({
    width: 16, height: 16, borderRadius: 3, display: "inline-flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: checked ? "var(--accent)" : "transparent",
    border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
    color: "#fff", fontSize: "0.6rem", fontWeight: 700,
    cursor: enabled ? "pointer" : "not-allowed", opacity: enabled ? 1 : 0.3,
  });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Fixed top sections ─────────────────────────────────── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ padding: "14px 16px 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>{gridId}</div>

        <div style={sectionTitle}>Toolbar &amp; UI</div>
        <div style={rowStyle}>
          <span>Toolbar</span>
          <Toggle value={showToolbar} onChange={() => setShowToolbar(!showToolbar)} size="sm" />
        </div>
        {toolbarFlags.map(flag => (
          <div key={flag.key} style={{ ...rowStyle, paddingLeft: 36, opacity: showToolbar ? 1 : 0.35 }}>
            <span>{flag.label}</span>
            <Toggle value={flag.value} onChange={() => showToolbar && toggleToolbarFlag(flag.key)} size="sm" disabled={!showToolbar} />
          </div>
        ))}
        <div style={rowStyle}>
          <span>Footer</span>
          <Toggle value={showFooter} onChange={() => setShowFooter(!showFooter)} size="sm" />
        </div>
        <div style={divider} />

        <div style={sectionTitle}>Default Sort</div>
        <div style={{ padding: "4px 16px 8px", display: "flex", gap: 8 }}>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ flex: 1, padding: "6px 10px", fontSize: "0.8rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
            <option value="">— None —</option>
            {grid.columns.map(c => (
              <option key={c.key} value={c.key}>{(typeof c.label === "string" ? c.label : resolveClientText(c.label)) || c.key}</option>
            ))}
          </select>
          <select value={sortDir} onChange={e => setSortDir(e.target.value as "ASC" | "DESC")} style={{ width: 80, padding: "6px 10px", fontSize: "0.8rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
            <option value="ASC">ASC</option>
            <option value="DESC">DESC</option>
          </select>
        </div>
        <div style={divider} />

        <div style={sectionTitle}>Column Restrictions</div>
        <div style={rowStyle}>
          <span>All columns available (unrestricted)</span>
          <Toggle value={unrestricted} onChange={() => handleUnrestrictedChange(!unrestricted)} size="sm" />
        </div>
        <div style={{ padding: "0 16px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>
          {unrestricted
            ? "Users can show/hide any column. Default controls which are visible initially."
            : "Allowed columns are the only ones users can ever see. Default controls initial visibility."}
        </div>
        <div style={divider} />

        <div style={{ ...sectionTitle, display: "flex", alignItems: "center" }}>
          <span>Columns</span>
          {!unrestricted && <span style={pill}>{allowedCount} allowed</span>}
          <span style={pill}>{defaultCount} default</span>
        </div>
      </div>

      {/* ── Column List (scrollable) ─────────────────────────────── */}
      <div style={{ flex: 1, margin: "0 10px", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: unrestricted ? "1fr 60px" : "1fr 60px 60px", padding: "4px 16px", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)", flexShrink: 0 }}>
          <span>Column</span>
          {!unrestricted && <span style={{ textAlign: "center" }}>Allowed</span>}
          <span style={{ textAlign: "center" }}>Default</span>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {columns.map(col => {
            const isAllowed = unrestricted || col.allowed;
            return (
              <div key={col.key} style={{ display: "grid", gridTemplateColumns: unrestricted ? "1fr 60px" : "1fr 60px 60px", alignItems: "center", padding: "5px 16px", fontSize: "0.8rem", color: isAllowed ? "var(--text-primary)" : "var(--text-muted)", borderBottom: "1px solid var(--border-light, rgba(0,0,0,0.04))", opacity: isAllowed ? 1 : 0.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</span>
                  {col.label !== col.key && <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", flexShrink: 0 }}>{col.key}</span>}
                </div>
                {!unrestricted && (
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span style={checkbox(col.allowed)} onClick={() => toggleAllowed(col.key)}>{col.allowed && "✓"}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={checkbox(col.default, isAllowed)} onClick={() => isAllowed && toggleDefault(col.key)}>{col.default && "✓"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
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
