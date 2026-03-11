"use client";

import { useEffect, useMemo, useState } from "react";
import { Input, Select } from "@/components/ui";
import { Toggle } from "@/components/ui/Toggle";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import type { FieldDef } from "@/platform/core/FieldDef";
import { Lookup } from "@/components/lookup/Lookup";

interface FieldRendererProps {
  field: FieldDef;
  designMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

function applyLookupMappings(field: FieldDef, record: any | null, reason: "select" | "hydrate" | "clear") {
  const panel = field.panel;
  const definition = field.lookupDefinition;
  const mappings = definition?.fieldMap ?? [];
  if (!panel || !mappings.length) return;
  if (reason === "hydrate" && definition?.hydrateNonTransient !== true) return;

  for (const mapping of mappings) {
    try {
      const targetField = panel.getField(mapping.target);
      const nextValue = reason === "clear" ? null : (record ? record[mapping.source] ?? null : null);
      targetField.setValue(nextValue);
    } catch {
      // Ignore invalid target mappings until designer validation is added.
    }
  }

  panel.refreshView?.();
}

function runLookupHandler(field: FieldDef, record: any | null, reason: "select" | "hydrate" | "clear", value: any) {
  const panel = field.panel;
  const handlerName = field.lookupDefinition?.handlerName?.trim();
  if (!panel || !handlerName) return;

  const handler = panel.form && typeof (panel.form as any)[handlerName] === "function"
    ? (panel.form as any)[handlerName]
    : (panel as any)[handlerName];
  if (typeof handler !== "function") return;

  const api = {
    field,
    panel,
    record,
    reason,
    value,
    setField: (targetKey: string, nextValue: any) => {
      panel.getField(targetKey).setValue(nextValue);
      panel.refreshView?.();
    },
    setFields: (updates: Record<string, any>) => {
      for (const [targetKey, nextValue] of Object.entries(updates || {})) {
        panel.getField(targetKey).setValue(nextValue);
      }
      panel.refreshView?.();
    },
    getField: (targetKey: string) => panel.getField(targetKey)?.value,
    currentRow: panel.currentRecord,
  };

  handler.call(panel.form ?? panel, api);
}

export function FieldRenderer({ field, designMode = false, selected = false, onSelect }: FieldRendererProps) {
  if (field.hidden) return null;

  const isNew = field.panel?.isNew ?? false;
  const panelReadOnly = field.panel?.readOnly ?? false;
  const effectiveReadOnly = designMode || panelReadOnly || (field.readOnly ?? false) || (!!field.keyField && !isNew);

  const [value, setValue] = useState(field.value);

  useEffect(() => {
    setValue(field.value);
  }, [field.value, field.panel?.displayNonce]);

  const handleChange = (v: unknown) => {
    if (effectiveReadOnly) return;
    setValue(v);
    field.setValue(v);
  };

  const lookupConfig = useMemo(() => {
    if (!field.lookupConfig) return undefined;
    const baseOnResolve = field.lookupConfig.onResolve;
    return {
      ...field.lookupConfig,
      readOnly: effectiveReadOnly || field.lookupConfig.readOnly === true,
      onResolve: (record: any | null, context: { reason: "select" | "hydrate" | "clear"; value: any }) => {
        baseOnResolve?.(record, context);
        applyLookupMappings(field, record, context.reason);
        runLookupHandler(field, record, context.reason, context.value);
      },
    };
  }, [effectiveReadOnly, field]);

  const readOnlyLookupText = useMemo(() => {
    if (!lookupConfig || !effectiveReadOnly) return null;

    const currentRecord = field.panel?.currentRecord ?? null;
    const rawValue = value ?? "";
    const displayField = lookupConfig.displayField;
    const valueField = lookupConfig.valueField;
    const displayValue = displayField ? currentRecord?.[displayField] : undefined;

    if (typeof lookupConfig.displayFormat === "function" && currentRecord) {
      try {
        const formatted = lookupConfig.displayFormat(currentRecord);
        if (formatted) return String(formatted);
      } catch {
        // Fallback to raw display fields below.
      }
    }

    if (displayValue !== undefined && displayValue !== null && String(displayValue).trim() !== "") {
      if (valueField && displayField && valueField !== displayField && rawValue) {
        return `${rawValue} - ${displayValue}`;
      }
      return String(displayValue);
    }

    return rawValue === null || rawValue === undefined ? "" : String(rawValue);
  }, [effectiveReadOnly, field.panel?.currentRecord, lookupConfig, value]);

  let input: React.ReactNode;

  switch (field.renderer) {
    case "boolean":
      input = <Toggle value={!!value} onChange={handleChange} readOnly={effectiveReadOnly} />;
      break;

    case "date":
    case "datetime":
      input = (
        <DatePicker
          value={typeof value === "string" ? value : null}
          onChange={handleChange}
          mode={field.renderer === "datetime" ? "datetime" : "date"}
          readOnly={effectiveReadOnly}
          placeholder={field.placeholder}
        />
      );
      break;

    case "number":
      input = <NumberInput value={String(value ?? "")} onChange={handleChange} scale={field.scale ?? 0} readOnly={effectiveReadOnly} placeholder={field.placeholder} />;
      break;

    case "textarea":
      input = (
        <textarea
          value={value ?? ""}
          readOnly={effectiveReadOnly}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          onChange={effectiveReadOnly ? undefined : e => handleChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg"
          style={{ minHeight: 80, background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)" }}
        />
      );
      break;

    case "select":
      input = (
        <Select
          value={String(value ?? "")}
          onChange={handleChange}
          options={[{ value: "", label: field.placeholder || "— Select —" }, ...(field.options || [])]}
          disabled={effectiveReadOnly}
        />
      );
      break;

    case "password":
      input = <Input type="password" value={String(value ?? "")} onChange={effectiveReadOnly ? undefined : handleChange} readOnly={effectiveReadOnly} autoComplete="new-password" placeholder={field.placeholder} maxLength={field.maxLength} />;
      break;

    case "readonly":
      input = <span style={{ color: "var(--text-muted)", fontSize: "var(--font-sm)" }}>{value ?? "—"}</span>;
      break;

    case "image":
      input = <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>Image — not yet implemented</span>;
      break;

    case "lookup":
      input = lookupConfig ? (
        effectiveReadOnly ? (
          <Input value={readOnlyLookupText ?? ""} readOnly />
        ) : (
          <Lookup
            value={value}
            onChange={handleChange}
            config={lookupConfig}
            label={field.getLabel()}
            hydrateNonce={field.panel?.displayNonce !== undefined ? String(field.panel.displayNonce) : undefined}
          />
        )
      ) : (
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>
          Lookup — no config
        </span>
      );
      break;

    case "svg": {
      const raw = String(value ?? "");
      input = (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Input value={raw} onChange={effectiveReadOnly ? undefined : handleChange} readOnly={effectiveReadOnly} />
          {raw && (
            <span
              dangerouslySetInnerHTML={{ __html: raw }}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                padding: "0.5rem", border: "1px solid var(--border)", borderRadius: 6,
                background: "var(--bg-subtle, #f9f9f9)", width: "fit-content",
                minWidth: 64, minHeight: 40,
              }}
            />
          )}
        </div>
      );
      break;
    }

    case "text":
    default:
      input = <Input value={String(value ?? "")} onChange={effectiveReadOnly ? undefined : handleChange} readOnly={effectiveReadOnly} placeholder={field.placeholder} maxLength={field.maxLength} />;
      break;
  }

  return (
    <div
      data-testid={`field-${field.key}`}
      onClick={designMode ? (e => { e.stopPropagation(); onSelect?.(); }) : undefined}
      style={{ display: "flex", flexDirection: "column", gap: 3, border: designMode ? (selected ? "2px solid rgba(245, 158, 11, 0.85)" : "1px dashed rgba(245, 158, 11, 0.45)") : undefined, borderRadius: designMode ? 8 : undefined, padding: designMode ? "0.6rem" : undefined, cursor: designMode ? "pointer" : undefined }}
    >
      <label style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {field.getLabel()}
        {field.required && <span style={{ color: "var(--danger-text)", marginLeft: 2 }}>*</span>}
      </label>
      {input}
      {field.hasError && (
        <span style={{ fontSize: "0.7rem", color: "var(--danger-text, #e53e3e)" }}>{field.errorMessage}</span>
      )}
    </div>
  );
}
