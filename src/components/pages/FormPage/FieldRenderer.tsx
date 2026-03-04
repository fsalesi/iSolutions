"use client";
import { Input, Select } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toggle } from "@/components/ui/Toggle";

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
      return <Input type="number" value={String(value ?? "")} onChange={v => onChange(v)}
        readOnly={readOnly} step={properties?.scale === 0 ? "1" : "any"} />;
    case "textarea":
      return <textarea value={value ?? ""} onChange={e => onChange(e.target.value)} readOnly={readOnly}
        className="w-full px-3 py-2 text-sm rounded-lg"
        style={{ minHeight: 80, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }} />;
    case "select":
      return <Select value={value ?? ""} onChange={onChange}
        options={[{ value: "", label: "— Select —" }, ...(properties?.options || [])]} />;
    case "readonly":
      return <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{value || "—"}</span>;
    case "text":
    default:
      return <Input value={String(value ?? "")} onChange={v => onChange(v)} readOnly={readOnly} />;
  }
}
