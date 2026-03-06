"use client";
import { useState, useEffect } from "react";
import { Input, Select, Toggle } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import * as LookupPresets from "@/components/lookup/presets";
import type { LookupConfig } from "@/components/lookup/LookupTypes";

// ── Schema ────────────────────────────────────────────────────────────────────

type PropType = "string" | "number" | "boolean" | "stringArray" | "fieldSelect" | "fieldMultiSelect" | "templateString";

interface PropDef {
  key: keyof LookupConfig;
  label: string;
  type: PropType;
  storeKey: string;
}

const PROP_DEFS: PropDef[] = [
  { key: "apiPath",         label: "API Path",          type: "string",           storeKey: "lookup_api_path" },
  { key: "valueField",      label: "Value Field",       type: "fieldSelect",      storeKey: "lookup_value_field" },
  { key: "displayField",    label: "Display Field",     type: "fieldSelect",      storeKey: "lookup_display_field" },
  { key: "displayTemplate", label: "Display Template",  type: "templateString",   storeKey: "lookup_display_template" },
  { key: "placeholder",     label: "Placeholder",       type: "string",           storeKey: "lookup_placeholder" },
  { key: "searchColumns",   label: "Search Columns",    type: "fieldMultiSelect", storeKey: "lookup_search_columns" },
  { key: "browsable",       label: "Browsable",         type: "boolean",          storeKey: "lookup_browsable" },
  { key: "browseTitle",     label: "Browse Title",      type: "string",           storeKey: "lookup_browse_title" },
  { key: "gridColumns",     label: "Grid Columns",      type: "fieldMultiSelect", storeKey: "lookup_grid_columns" },
  { key: "multiple",        label: "Multiple",          type: "boolean",          storeKey: "lookup_multiple" },
  { key: "preload",         label: "Preload",           type: "boolean",          storeKey: "lookup_preload" },
  { key: "dropdownLimit",   label: "Dropdown Limit",    type: "number",           storeKey: "lookup_dropdown_limit" },
  { key: "readOnly",        label: "Read-only",         type: "boolean",          storeKey: "lookup_read_only" },
  { key: "minChars",        label: "Min Chars",         type: "number",           storeKey: "lookup_min_chars" },
  { key: "dropdownColumns", label: "Dropdown Columns",  type: "fieldMultiSelect", storeKey: "lookup_dropdown_columns" },
];

// ── Component defaults ────────────────────────────────────────────────────────

const COMPONENT_DEFAULTS: Partial<LookupConfig> = {
  multiple: false,
  preload: false,
  browsable: true,
  readOnly: false,
  minChars: 1,
  dropdownLimit: 10,
  browseTitle: "Select {field label}",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDefaultConfig(presetName: string): Partial<LookupConfig> {
  const fn = (LookupPresets as any)[presetName];
  if (!fn) return {};
  try { return fn({ domain: "" }) as Partial<LookupConfig>; }
  catch { return {}; }
}

function extractKey(item: any): string {
  if (item && typeof item === "object" && "key" in item) return String(item.key);
  return String(item);
}

function parseStringArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(extractKey).filter(Boolean);
  return String(val).split(",").map(s => s.trim()).filter(Boolean);
}

function formatDefault(val: any, type: PropType): string {
  if (val === undefined || val === null) return "—";
  if (type === "fieldMultiSelect" || type === "stringArray")
    return Array.isArray(val) ? val.map(extractKey).join(", ") : String(val);
  if (type === "boolean") return val ? "Yes" : "No";
  return String(val);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LookupPropertiesPanel({ open, onClose, presetName, properties, onPropertiesChange }: {
  open: boolean;
  onClose: () => void;
  presetName?: string;
  properties: Record<string, any>;
  onPropertiesChange: (updates: Record<string, any>) => void;
}) {
  const [defaults, setDefaults] = useState<Partial<LookupConfig>>({});
  const [apiFields, setApiFields] = useState<string[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);

  useEffect(() => {
    if (presetName) setDefaults(getDefaultConfig(presetName));
    else setDefaults({});
  }, [presetName]);

  // Fetch available fields from the API path
  useEffect(() => {
    const effectiveApiPath = properties["lookup_api_path"] ?? defaults.apiPath;
    if (!effectiveApiPath) { setApiFields([]); return; }

    setFieldsLoading(true);
    const sep = String(effectiveApiPath).includes("?") ? "&" : "?";
    fetch(`${effectiveApiPath}${sep}limit=1`)
      .then(r => r.json())
      .then(data => {
        const rows = data?.rows ?? data?.data ?? [];
        if (rows.length > 0) setApiFields(Object.keys(rows[0]));
        else setApiFields([]);
      })
      .catch(() => setApiFields([]))
      .finally(() => setFieldsLoading(false));
  }, [properties["lookup_api_path"], defaults.apiPath]);

  const isDefault = (storeKey: string) =>
    properties[storeKey] === undefined || properties[storeKey] === null;

  const toggleDefault = (def: PropDef, useDefault: boolean) => {
    if (useDefault) {
      const updates = { ...properties };
      delete updates[def.storeKey];
      onPropertiesChange(updates);
    } else {
      const defaultVal = def.key in defaults ? defaults[def.key] : COMPONENT_DEFAULTS[def.key];
      let initVal: any;
      if (def.type === "boolean") initVal = defaultVal ?? false;
      else if (def.type === "number") initVal = defaultVal ?? 0;
      else if (def.type === "fieldMultiSelect" || def.type === "stringArray")
        initVal = Array.isArray(defaultVal) ? defaultVal.map(extractKey).join(", ") : (defaultVal ?? "");
      else initVal = defaultVal ?? "";
      onPropertiesChange({ ...properties, [def.storeKey]: initVal });
    }
  };

  const setOverride = (storeKey: string, value: any) =>
    onPropertiesChange({ ...properties, [storeKey]: value });

  const effectiveBrowsable = !isDefault("lookup_browsable")
    ? !!properties["lookup_browsable"]
    : defaults.browsable !== undefined ? !!defaults.browsable : true;

  const effectivePreload = !isDefault("lookup_preload")
    ? !!properties["lookup_preload"]
    : defaults.preload !== undefined ? !!defaults.preload : false;

  const fieldOptions = apiFields.map(f => ({ value: f, label: f }));

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={`Lookup: ${presetName || "No preset"}`}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}>
            Done
          </button>
        </div>
      }
    >
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
        {!presetName && (
          <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
            Select a preset first.
          </div>
        )}

        {presetName && PROP_DEFS.map(def => {
          const usingDefault = isDefault(def.storeKey);
          const defaultVal = def.key in defaults ? defaults[def.key] : COMPONENT_DEFAULTS[def.key];
          const overrideVal = properties[def.storeKey];

          const isBrowseDependent = def.key === "browseTitle" || def.key === "gridColumns";
          const isPreloadDependent = def.key === "dropdownLimit" || def.key === "minChars";
          const isDisabled = (isBrowseDependent && !effectiveBrowsable) || (isPreloadDependent && effectivePreload);
          const showNA = isPreloadDependent && effectivePreload;

          // For fieldSelect/fieldMultiSelect, show inline field tags as default display
          const defaultDisplay = (def.type === "fieldSelect" || def.type === "fieldMultiSelect")
            ? formatDefault(defaultVal, def.type)
            : showNA ? "N/A" : formatDefault(defaultVal, def.type);

          return (
            <div key={def.key} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "4px 12px",
              alignItems: "start",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
              opacity: isDisabled ? 0.4 : 1,
              pointerEvents: isDisabled ? "none" : "auto",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {def.label}
                  {fieldsLoading && (def.type === "fieldSelect" || def.type === "fieldMultiSelect") && (
                    <span style={{ marginLeft: 6, color: "var(--text-muted)", fontWeight: 400 }}>loading…</span>
                  )}
                </label>

                {def.type === "boolean" ? (
                  <div style={{ paddingTop: 4, opacity: usingDefault ? 0.5 : 1, pointerEvents: usingDefault ? "none" : "auto" }}>
                    <Toggle value={usingDefault ? !!defaultVal : !!overrideVal} onChange={v => setOverride(def.storeKey, v)} />
                  </div>

                ) : usingDefault ? (
                  <div style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 13,
                    background: "var(--bg-muted)", border: "1px solid var(--border)",
                    color: "var(--text-muted)", fontStyle: "italic", minHeight: 34,
                    display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4,
                  }}>
                    {(def.type === "fieldSelect" || def.type === "fieldMultiSelect") && defaultVal
                      ? parseStringArray(defaultVal).map(f => (
                          <span key={f} style={{
                            padding: "1px 7px", borderRadius: 4, fontSize: 11,
                            background: "var(--border)", color: "var(--text-secondary)",
                          }}>{extractKey(f)}</span>
                        ))
                      : defaultDisplay
                    }
                  </div>

                ) : def.type === "fieldSelect" ? (
                  <Select
                    value={String(overrideVal ?? "")}
                    onChange={v => setOverride(def.storeKey, v)}
                    options={[
                      { value: "", label: apiFields.length ? "— Select field —" : "— Enter API Path first —" },
                      ...fieldOptions,
                    ]}
                  />

                ) : def.type === "fieldMultiSelect" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {apiFields.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {apiFields.map(f => {
                          const selected = parseStringArray(overrideVal).includes(f);
                          return (
                            <button
                              key={f}
                              onClick={() => {
                                const cur = parseStringArray(overrideVal);
                                const next = selected ? cur.filter(x => x !== f) : [...cur, f];
                                setOverride(def.storeKey, next.join(", "));
                              }}
                              style={{
                                padding: "2px 9px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                                background: selected ? "var(--accent)" : "var(--bg-muted)",
                                color: selected ? "#fff" : "var(--text-secondary)",
                                border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                              }}
                            >{f}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <Input
                        value={String(overrideVal ?? "")}
                        onChange={v => setOverride(def.storeKey, v)}
                        placeholder="field1, field2, ..."
                      />
                    )}
                  </div>

                ) : def.type === "templateString" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      id={`tpl-input-${def.key}`}
                      type="text"
                      value={String(overrideVal ?? "")}
                      onChange={e => setOverride(def.storeKey, e.target.value)}
                      placeholder="{field1} - {field2}"
                      style={{
                        width: "100%", padding: "6px 10px", borderRadius: 6, fontSize: 13,
                        background: "var(--bg-input)", border: "1px solid var(--border)",
                        color: "var(--text-primary)", outline: "none", boxSizing: "border-box",
                      }}
                    />
                    {apiFields.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {apiFields.map(f => (
                          <button
                            key={f}
                            onClick={() => {
                              const el = document.getElementById(`tpl-input-${def.key}`) as HTMLInputElement | null;
                              const token = `{${f}}`;
                              if (el) {
                                const start = el.selectionStart ?? (overrideVal ? String(overrideVal).length : 0);
                                const end = el.selectionEnd ?? start;
                                const cur = String(overrideVal ?? "");
                                const next = cur.slice(0, start) + token + cur.slice(end);
                                setOverride(def.storeKey, next);
                                // Restore focus + cursor after state update
                                setTimeout(() => {
                                  el.focus();
                                  el.setSelectionRange(start + token.length, start + token.length);
                                }, 0);
                              } else {
                                setOverride(def.storeKey, String(overrideVal ?? "") + token);
                              }
                            }}
                            style={{
                              padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                              background: "var(--bg-muted)", color: "var(--text-secondary)",
                              border: "1px solid var(--border)", fontFamily: "monospace",
                            }}
                          >{`{${f}}`}</button>
                        ))}
                      </div>
                    )}
                  </div>

                ) : def.type === "number" ? (
                  <Input type="number" value={String(overrideVal ?? "")}
                    onChange={v => setOverride(def.storeKey, v === "" ? undefined : Number(v))} />

                ) : (
                  <Input value={String(overrideVal ?? "")} onChange={v => setOverride(def.storeKey, v)} />
                )}
              </div>

              {/* Default checkbox */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 18 }}>
                <input
                  type="checkbox"
                  id={`default-${def.key}`}
                  checked={usingDefault}
                  onChange={e => toggleDefault(def, e.target.checked)}
                  style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--accent)" }}
                />
                <label htmlFor={`default-${def.key}`} style={{ fontSize: 10, color: "var(--text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Default
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </SlidePanel>
  );
}
