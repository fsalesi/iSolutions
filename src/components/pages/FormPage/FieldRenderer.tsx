"use client";
import { Input, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toggle } from "@/components/ui/Toggle";
import { NumberInput } from "@/components/ui/NumberInput";
import { Lookup } from "@/components/lookup/Lookup";
import * as LookupPresets from "@/components/lookup/presets";

export function FieldRenderer({ renderer, value, onChange, fieldKey, readOnly, properties }: {
  renderer: string; value: any; onChange: (v: any) => void; fieldKey: string;
  readOnly?: boolean; properties?: Record<string, any>;
}) {
  switch (renderer) {
    case "checkbox":
      return <Toggle value={!!value} onChange={onChange} />;
    case "date":
    case "datetime":
      return <DatePicker value={value || ""} onChange={onChange} />;
    case "number":
      return <NumberInput value={String(value ?? "")} onChange={onChange}
        scale={properties?.scale ?? 2} readOnly={readOnly} />;
    case "textarea":
      return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} readOnly={readOnly}
        className="w-full px-3 py-2 text-sm rounded-lg"
        style={{ minHeight: 80, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />;
    case "select":
      return <Select value={value ?? ""} onChange={onChange}
        options={[{ value: "", label: "— Select —" }, ...(properties?.options || [])]} />;
    case "readonly":
      return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{value || "—"}</span>;
    case "lookup": {
      const presetName = properties?.lookup_preset as string | undefined;
      const presetFn = presetName ? (LookupPresets as any)[presetName] : undefined;
      if (!presetFn) {
        return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)", fontStyle: "italic" }}>
          {presetName ? `Unknown preset: ${presetName}` : "No preset selected"}
        </span>;
      }
      const overrides: Record<string, any> = {};
      if (properties?.lookup_placeholder) overrides.placeholder = properties.lookup_placeholder;
      if (properties?.lookup_multiple !== undefined) overrides.multiple = properties.lookup_multiple;
      if (properties?.lookup_browsable !== undefined) overrides.browsable = properties.lookup_browsable;
      if (properties?.lookup_preload !== undefined) overrides.preload = properties.lookup_preload;
      if (properties?.lookup_min_chars !== undefined) overrides.minChars = properties.lookup_min_chars;
      if (properties?.lookup_dropdown_limit !== undefined) overrides.dropdownLimit = properties.lookup_dropdown_limit;
      if (properties?.lookup_search_columns) overrides.searchColumns = String(properties.lookup_search_columns).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (properties?.lookup_dropdown_columns) overrides.dropdownColumns = String(properties.lookup_dropdown_columns).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (properties?.lookup_grid_columns) overrides.gridColumns = String(properties.lookup_grid_columns).split(",").map((s: string) => ({ key: s.trim(), label: s.trim() }));
      if (readOnly) overrides.readOnly = true;
      const config = presetFn(overrides);
      return <Lookup config={config} value={value ?? ""} onChange={onChange} />;
    }
    case "text":
    default:
      return <Input value={String(value ?? "")} onChange={v => onChange(v)} readOnly={readOnly} />;
  }
}
