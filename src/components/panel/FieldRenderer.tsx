"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import type { FieldDef } from "@/platform/core/FieldDef";

interface FieldRendererProps {
  field: FieldDef;
  onChange?: (value: any) => void;
}

export function FieldRenderer({ field, onChange }: FieldRendererProps) {
  if (field.hidden) return null;

  // keyField fields are editable on New, read-only when editing an existing record
  // plain readOnly fields are always read-only
  const isNew = field.panel?.isNew ?? false;
  const effectiveReadOnly = field.keyField ? !isNew : (field.readOnly ?? false);

  // Local React state — initialized from field.value (set by display() cascade)
  const [value, setValue] = useState<any>(field.value);

  const handleChange = (v: any) => {
    setValue(v);
    field.setValue(v);   // marks panel dirty
    onChange?.(v);
  };

  let input: React.ReactNode;

  switch (field.renderer) {
    case "checkbox":
      input = <Toggle value={!!value} onChange={handleChange} />;
      break;

    case "date":
    case "datetime":
      input = <DatePicker value={value || ""} onChange={handleChange} />;
      break;

    case "number":
      input = <NumberInput value={String(value ?? "")} onChange={handleChange} scale={field.scale ?? 0} readOnly={field.readOnly} />;
      break;

    case "textarea":
      input = (
        <textarea
          value={value ?? ""}
          readOnly={effectiveReadOnly}
          onChange={effectiveReadOnly ? undefined : e => handleChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg"
          style={{ minHeight: 80, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
        />
      );
      break;

    case "select":
      input = (
        <Select
          value={value ?? ""}
          onChange={handleChange}
          options={[{ value: "", label: "— Select —" }, ...(field.options || [])]}
        />
      );
      break;

    case "password":
      input = <Input type="password" value={String(value ?? "")} onChange={effectiveReadOnly ? undefined : handleChange} readOnly={effectiveReadOnly} autoComplete="new-password" />;
      break;

    case "readonly":
      input = <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{value ?? "—"}</span>;
      break;

    case "image":
      input = <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>Image — not yet implemented</span>;
      break;

    case "lookup":
      input = <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>Lookup — not yet implemented</span>;
      break;

    case "text":
    default:
      input = <Input value={String(value ?? "")} onChange={effectiveReadOnly ? undefined : handleChange} readOnly={effectiveReadOnly} />;
      break;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {field.label}
        {field.required && <span style={{ color: "var(--danger-text)", marginLeft: 2 }}>*</span>}
      </label>
      {input}
      {field.hasError && (
        <span style={{ fontSize: "0.7rem", color: "var(--danger-text, #e53e3e)" }}>{field.errorMessage}</span>
      )}
    </div>
  );
}
