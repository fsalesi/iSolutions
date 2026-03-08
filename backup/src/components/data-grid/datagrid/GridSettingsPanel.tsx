"use client";
/**
 * GridSettingsPanel — admin slide panel for configuring grid_defaults.
 * Allowed columns, default visible columns, UI visibility flags.
 */
import { useState, useEffect } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { ColumnDef } from "./types";

export interface GridSettings {
  show_search?: boolean;
  show_footer?: boolean;
  show_excel?: boolean;
}

export function GridSettingsPanel({
  open,
  onClose,
  gridId,
  userId,
  columns,
  onSettingsChanged,
}: {
  open: boolean;
  onClose: () => void;
  gridId: string;
  userId: string;
  columns: ColumnDef<any>[];
  onSettingsChanged: (settings: GridSettings, allowedKeys: string[] | null, defaultKeys: string[] | null) => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [unrestricted, setUnrestricted] = useState(true);
  const [allowedKeys, setAllowedKeys] = useState<string[]>([]);
  const [defaultKeys, setDefaultKeys] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showExcel, setShowExcel] = useState(true);

  const allKeys = columns.map(c => c.key);

  // Load on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch(`/api/grid-prefs?grid=${encodeURIComponent(gridId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.allowedKeys) {
          setUnrestricted(false);
          setAllowedKeys(data.allowedKeys);
        } else {
          setUnrestricted(true);
          setAllowedKeys([...allKeys]);
        }
        setDefaultKeys(data.adminDefault || [...allKeys]);
        setShowSearch(data.settings?.show_search !== false);
        setShowFooter(data.settings?.show_footer !== false);
        setShowExcel(data.settings?.show_excel !== false);
      })
      .catch(() => setError("Failed to load grid settings"))
      .finally(() => setLoading(false));
  }, [open, gridId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When switching to unrestricted, restore all keys
  const handleUnrestrictedChange = (val: boolean) => {
    setUnrestricted(val);
    if (val) {
      setAllowedKeys([...allKeys]);
      setDefaultKeys(prev => prev.filter(k => allKeys.includes(k)).length > 0 ? prev : [...allKeys]);
    }
  };

  const toggleAllowed = (key: string) => {
    setAllowedKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      // Remove from default if no longer allowed
      setDefaultKeys(d => d.filter(k => next.includes(k)));
      return next;
    });
  };

  const toggleDefault = (key: string) => {
    const pool = unrestricted ? allKeys : allowedKeys;
    if (!pool.includes(key)) return;
    setDefaultKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        grid: gridId,
        user: userId,
        admin: true,
        allowed_keys: unrestricted ? null : allowedKeys,
        visible_keys: defaultKeys.length > 0 ? defaultKeys : null,
        settings: {
          show_search: showSearch,
          show_footer: showFooter,
          show_excel: showExcel,
        },
      };
      const res = await fetch("/api/grid-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      onSettingsChanged(
        payload.settings,
        unrestricted ? null : allowedKeys,
        defaultKeys.length > 0 ? defaultKeys : null,
      );
      onClose();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Columns to show in the allowed/default lists
  const pickableColumns = columns.filter(c => unrestricted || allowedKeys.includes(c.key));

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={`Grid Settings — ${gridId}`}
      minWidth={420}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          {error && <span className="text-sm" style={{ color: "var(--danger-text)" }}>{error}</span>}
          {!error && <span />}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center h-32" style={{ color: "var(--text-muted)" }}>
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-4">

          {/* ── UI Visibility ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Toolbar &amp; UI
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { label: "Show search bar", value: showSearch, set: setShowSearch },
                { label: "Show footer",     value: showFooter, set: setShowFooter },
                { label: "Show Excel button", value: showExcel, set: setShowExcel },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer select-none py-1">
                  <button
                    onClick={() => set(!value)}
                    className="flex-shrink-0 w-9 h-5 rounded-full transition-colors relative"
                    style={{ background: value ? "var(--accent)" : "var(--border)" }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                      style={{ transform: value ? "translateX(16px)" : "translateX(0)" }}
                    />
                  </button>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ── Column Restrictions ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Column Restrictions
            </h3>
            <label className="flex items-center gap-3 cursor-pointer select-none py-1 mb-3">
              <button
                onClick={() => handleUnrestrictedChange(!unrestricted)}
                className="flex-shrink-0 w-9 h-5 rounded-full transition-colors relative"
                style={{ background: unrestricted ? "var(--accent)" : "var(--border)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: unrestricted ? "translateX(16px)" : "translateX(0)" }}
                />
              </button>
              <span className="text-sm" style={{ color: "var(--text-primary)" }}>All columns available (unrestricted)</span>
            </label>

            {/* Column list — two checkboxes per row: Allowed + Default */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {/* Header */}
              <div className="grid text-xs font-medium px-3 py-2 gap-2"
                style={{ gridTemplateColumns: "1fr 72px 72px", background: "var(--bg-surface-alt)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <span>Column</span>
                {!unrestricted && <span className="text-center">Allowed</span>}
                <span className={unrestricted ? "" : "text-center"}>Default</span>
              </div>

              {/* Rows */}
              <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                {columns.map(col => {
                  const isAllowed = unrestricted || allowedKeys.includes(col.key);
                  const isDefault = defaultKeys.includes(col.key);
                  return (
                    <div key={col.key}
                      className="grid items-center px-3 py-1.5 gap-2 text-sm"
                      style={{
                        gridTemplateColumns: unrestricted ? "1fr 72px" : "1fr 72px 72px",
                        borderBottom: "1px solid var(--border-light)",
                        color: isAllowed ? "var(--text-primary)" : "var(--text-muted)",
                        opacity: isAllowed ? 1 : 0.4,
                      }}
                    >
                      <span className="truncate">{col.label || col.key}</span>

                      {/* Allowed toggle */}
                      {!unrestricted && (
                        <div className="flex justify-center">
                          <button onClick={() => toggleAllowed(col.key)}
                            className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                            style={{
                              background: isAllowed ? "var(--accent)" : "var(--bg-surface-alt)",
                              border: `1px solid ${isAllowed ? "var(--accent)" : "var(--border)"}`,
                              color: "#fff",
                            }}
                          >
                            {isAllowed && <Icon name="check" size={11} />}
                          </button>
                        </div>
                      )}

                      {/* Default toggle */}
                      <div className={unrestricted ? "" : "flex justify-center"}>
                        <button onClick={() => isAllowed && toggleDefault(col.key)}
                          className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                          style={{
                            background: isDefault ? "var(--accent)" : "var(--bg-surface-alt)",
                            border: `1px solid ${isDefault ? "var(--accent)" : "var(--border)"}`,
                            color: "#fff",
                            cursor: isAllowed ? "pointer" : "not-allowed",
                            opacity: isAllowed ? 1 : 0.3,
                          }}
                        >
                          {isDefault && <Icon name="check" size={11} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              {unrestricted
                ? "Users can show/hide any column. Default controls which are visible initially."
                : "Allowed columns are the only ones users can ever see. Default controls initial visibility."}
            </p>
          </section>

        </div>
      )}
    </SlidePanel>
  );
}
