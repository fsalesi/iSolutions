"use client";
import { useState, useEffect, useMemo } from "react";
import { Input, Select, Toggle } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import * as LookupPresets from "@/components/lookup/presets";
import type { LookupConfig } from "@/components/lookup/LookupTypes";

// -- Schema ---------------------------------------------------------------------

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

// -- Component defaults ----------------------------------------------------------

const COMPONENT_DEFAULTS: Partial<LookupConfig> = {
  multiple: false,
  preload: false,
  browsable: true,
  readOnly: false,
  minChars: 1,
  dropdownLimit: 10,
  browseTitle: "Select {field label}",
};

type LookupMap = { source: string; target: string };

// -- Helpers --------------------------------------------------------------------

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

function parseLookupMappings(raw: unknown): LookupMap[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const source = String((m as any).source ?? "").trim();
        const target = String((m as any).target ?? "").trim();
        return { source, target };
      })
      .filter((m): m is LookupMap => !!m);
  }

  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([target, source]) => ({ source: String(source ?? "").trim(), target: String(target ?? "").trim() }))
      .filter((m) => m.source && m.target);
  }

  const text = String(raw).trim();
  if (!text) return [];

  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      return parseLookupMappings(JSON.parse(text));
    } catch {
      // fall through to delimited parser
    }
  }

  return text
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token.includes("|")) {
        const [source, target] = token.split("|").map((v) => v.trim());
        return source && target ? { source, target } : null;
      }
      if (token.includes("->")) {
        const [source, target] = token.split("->").map((v) => v.trim());
        return source && target ? { source, target } : null;
      }
      return null;
    })
    .filter((m): m is LookupMap => !!m);
}

function serializeLookupMappings(rows: LookupMap[]): string {
  return rows
    .map((m) => ({ source: String(m.source || "").trim(), target: String(m.target || "").trim() }))
    .filter((m) => m.source && m.target)
    .map((m) => `${m.source}|${m.target}`)
    .join(",");
}

// -- Component ------------------------------------------------------------------

export function LookupPropertiesPanel({ open, onClose, presetName, properties, onPropertiesChange, layoutFields, formKey }: {
  open: boolean;
  onClose: () => void;
  presetName?: string;
  properties: Record<string, any>;
  onPropertiesChange: (updates: Record<string, any>) => void;
  layoutFields?: string[];
  formKey?: string;
}) {
  const [defaults, setDefaults] = useState<Partial<LookupConfig>>({});
  const [apiFields, setApiFields] = useState<string[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [availableHandlers, setAvailableHandlers] = useState<string[]>([]);

  const isCustom = presetName === "__custom__";

  useEffect(() => {
    // Custom preset has no base defaults — user configures everything
    if (presetName && !isCustom) setDefaults(getDefaultConfig(presetName));
    else setDefaults({});
  }, [presetName, isCustom]);

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

  useEffect(() => {
    if (!open) return;
    const key = String(formKey || "").trim();
    if (!key) {
      setAvailableHandlers([]);
      return;
    }

    fetch("/api/form_lookup_handlers/handlers?form_key=" + encodeURIComponent(key))
      .then((r) => r.json())
      .then((d) => setAvailableHandlers(Array.isArray(d?.handlers) ? d.handlers : []))
      .catch(() => setAvailableHandlers([]));
  }, [open, formKey]);

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

  const mappedRows = useMemo(
    () => parseLookupMappings(properties["lookup_field_map"] ?? properties["lookup_other_fields"] ?? properties["lookup_extra_fields"] ?? properties["other_fields"]),
    [properties["lookup_field_map"], properties["lookup_other_fields"], properties["lookup_extra_fields"], properties["other_fields"]],
  );

  const targetFields = useMemo(() => {
    const raw = (layoutFields || []).map(v => String(v || "").trim()).filter(Boolean);
    return Array.from(new Set(raw)).sort((a, b) => a.localeCompare(b));
  }, [layoutFields]);

  const upsertMappings = (rows: LookupMap[]) => {
    const next = serializeLookupMappings(rows);
    const updates = { ...properties };

    if (rows.length > 0) updates.lookup_field_map = rows;
    else delete updates.lookup_field_map;

    delete updates.lookup_extra_fields;
    delete updates.other_fields;
    if (next) updates.lookup_other_fields = next;
    else delete updates.lookup_other_fields;

    onPropertiesChange(updates);
  };

  const setMapCell = (idx: number, patch: Partial<LookupMap>) => {
    const rows = [...mappedRows];
    rows[idx] = { ...rows[idx], ...patch };
    upsertMappings(rows);
  };

  const addMapRow = () => upsertMappings([...mappedRows, { source: "", target: "" }]);
  const removeMapRow = (idx: number) => upsertMappings(mappedRows.filter((_, i) => i !== idx));

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isCustom ? "Lookup: Custom" : `Lookup: ${presetName || "No preset"}`}
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
        {isCustom && (
          <div style={{
            padding: "10px 12px", borderRadius: 6, marginBottom: 8,
            background: "var(--bg-muted)", border: "1px solid var(--border)",
            fontSize: 12, color: "var(--text-secondary)",
          }}>
            Configure all lookup properties manually. At minimum, set <strong>API Path</strong>, <strong>Value Field</strong>, and <strong>Display Field</strong>.
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
                                padding: "2px 8px", borderRadius: 5, fontSize: 12,
                                border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                                background: selected ? "rgba(59,130,246,0.12)" : "var(--bg-surface)",
                                color: selected ? "var(--accent)" : "var(--text-secondary)",
                              }}
                            >{f}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <Input
                        value={String(overrideVal ?? "")}
                        onChange={v => setOverride(def.storeKey, v)}
                        placeholder="field1, field2"
                      />
                    )}
                  </div>

                ) : def.type === "number" ? (
                  <Input type="number" value={String(overrideVal ?? "")} onChange={v => setOverride(def.storeKey, Number(v) || 0)} />
                ) : (
                  <Input value={String(overrideVal ?? "")} onChange={v => setOverride(def.storeKey, v)} />
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                <input type="checkbox" checked={usingDefault} onChange={e => toggleDefault(def, e.target.checked)} />
                Use default
              </label>
            </div>
          );
        })}

        {presetName && (
          <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
              Lookup Behavior
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Handler Name (optional)
                </label>
                {availableHandlers.length > 0 ? (
                  <Select
                    value={String(properties.lookup_handler ?? "")}
                    onChange={(v) => setOverride("lookup_handler", v)}
                    options={[
                      { value: "", label: "- none -" },
                      ...availableHandlers.map((k) => ({ value: k, label: k })),
                    ]}
                  />
                ) : (
                  <Input
                    value={String(properties.lookup_handler ?? "")}
                    onChange={(v) => setOverride("lookup_handler", v)}
                    placeholder="e.g. userLookupResolved"
                  />
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  Calls your page's <code>lookupHandlers</code> entry after mapping.
                </div>
              </div>

              <div>
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  Hydrate Non-Transient Targets
                </label>
                <Toggle
                  value={properties.lookup_hydrate_non_transient === true}
                  onChange={(v) => setOverride("lookup_hydrate_non_transient", v)}
                />
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  When on, record load/refetch can also update persisted mapped targets.
                </div>
              </div>
            </div>
          </div>
        )}

        {presetName && (
          <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Populate Other Fields
              </div>
              <button
                type="button"
                onClick={addMapRow}
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-muted)",
                  color: "var(--text-primary)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                }}
              >
                Add Mapping
              </button>
            </div>

            {mappedRows.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 6 }}>
                No mappings configured.
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {mappedRows.map((row, idx) => (
                <div key={`${idx}-${row.source}-${row.target}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <div>
                    <label className="text-xs" style={{ color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Source</label>
                    {apiFields.length > 0 ? (
                      <Select
                        value={row.source}
                        onChange={(v) => setMapCell(idx, { source: v })}
                        options={[{ value: "", label: "— Source field —" }, ...fieldOptions]}
                      />
                    ) : (
                      <Input value={row.source} onChange={(v) => setMapCell(idx, { source: v })} placeholder="lookup field" />
                    )}
                  </div>

                  <div>
                    <label className="text-xs" style={{ color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Target</label>
                    {targetFields.length > 0 ? (
                      <Select
                        value={row.target}
                        onChange={(v) => setMapCell(idx, { target: v })}
                        options={[{ value: "", label: "— Target field —" }, ...targetFields.map(f => ({ value: f, label: f }))]}
                      />
                    ) : (
                      <Input value={row.target} onChange={(v) => setMapCell(idx, { target: v })} placeholder="screen field" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMapRow(idx)}
                    title="Remove mapping"
                    style={{
                      marginTop: 18,
                      border: "1px solid rgba(239,68,68,0.35)",
                      background: "rgba(239,68,68,0.08)",
                      color: "#ef4444",
                      borderRadius: 6,
                      width: 34,
                      height: 34,
                      fontSize: 16,
                      lineHeight: "16px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
              Stored as <code>source|target</code> pairs (compat: <code>lookup_other_fields</code>).
            </div>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
