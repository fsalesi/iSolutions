"use client";
/**
 * useFieldHelper — Factory hook that returns a `field()` function
 * for auto-wiring form fields with minimal boilerplate.
 *
 * Usage:
 *   const field = useFieldHelper({ row, onChange, table, colTypes, colScales, isNew });
 *   return (
 *     <Section title="General">
 *       {field("name", { autoFocus: isNew })}
 *       {field("email", { type: "email", required: true })}
 *       {field("is_active", { colorOn: "green", colorOff: "red" })}
 *       {field("locale", { type: "select", options: localeOpts })}
 *     </Section>
 *   );
 */
import { ReactNode, useCallback } from "react";
import { useT } from "@/context/TranslationContext";
import { Field, Input, Select, Checkbox } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { Toggle } from "@/components/ui/Toggle";
import { EmailInput } from "@/components/ui/EmailInput";
import { Lookup } from "@/components/lookup/Lookup";
import type { LookupConfig } from "@/components/lookup/LookupTypes";

type ColType = "text" | "number" | "boolean" | "date" | "datetime";

interface FieldHelperConfig {
  row: any;
  onChange: (field: string, value: any) => void;
  table: string;
  colTypes?: Record<string, ColType>;
  colScales?: Record<string, number>;
  isNew?: boolean;
}

type FieldType = "input" | "email" | "select" | "checkbox" | "toggle" | "datepicker" | "number" | "lookup";

interface FieldOverrides {
  /** Override the auto-detected component type */
  type?: FieldType;
  /** Override the translated label */
  label?: string;
  /** Field is required */
  required?: boolean;
  /** Field is read-only */
  readOnly?: boolean;
  /** Autofocus this field */
  autoFocus?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Select options (required when type="select") */
  options?: { value: string; label: string }[];
  /** NumberInput decimal scale */
  scale?: number;
  /** Toggle colors */
  colorOn?: string;
  colorOff?: string;
  /** Toggle labels */
  labelOn?: string;
  labelOff?: string;
  labelNull?: string;
  /** Toggle triState */
  triState?: boolean;
  /** Checkbox label (text next to checkbox) */
  checkLabel?: string;
  /** EmailInput multiple mode */
  multiple?: boolean;
  /** DatePicker mode */
  mode?: "date" | "datetime" | "range";
  /** DatePicker range props */
  valueTo?: string | null;
  onChangeTo?: (v: string | null) => void;
  /** DatePicker presets */
  presets?: boolean;
  /** Lookup config (required when type="lookup") */
  lookup?: LookupConfig;
  /** Any extra props to spread on the inner component */
  [key: string]: any;
}

/** Detect component type from DB column type */
function detectType(colType: ColType | undefined, fieldName: string): FieldType {
  if (!colType || colType === "text") {
    // Smart detection from field name
    if (fieldName === "email" || fieldName.endsWith("_email") || fieldName.endsWith("_emails")) return "email";
    return "input";
  }
  if (colType === "boolean") return "toggle";
  if (colType === "number") return "number";
  if (colType === "datetime" || colType === "date") return "datepicker";
  return "input";
}

export function useFieldHelper(config: FieldHelperConfig) {
  const t = useT();
  const { row, onChange, table, colTypes = {}, colScales = {}, isNew } = config;

  const field = useCallback((name: string, overrides?: FieldOverrides): ReactNode => {
    const {
      type: typeOverride,
      label: labelOverride,
      required,
      readOnly,
      autoFocus,
      placeholder,
      options,
      scale: scaleOverride,
      colorOn,
      colorOff,
      labelOn,
      labelOff,
      labelNull,
      triState,
      checkLabel,
      multiple,
      mode,
      valueTo,
      onChangeTo,
      presets,
      lookup,
      // Collect remaining props
      ...extraProps
    } = overrides || {};

    const colType = colTypes[name];
    const fieldType = typeOverride || detectType(colType, name);
    const label = labelOverride || t(`${table}.field.${name}`, humanize(name));
    const value = row[name];
    const handleChange = (v: any) => onChange(name, v);

    let component: ReactNode;

    switch (fieldType) {
      case "input":
        component = (
          <Input
            value={value ?? ""}
            onChange={handleChange}
            readOnly={readOnly}
            autoFocus={autoFocus}
            placeholder={placeholder}
            {...extraProps}
          />
        );
        break;

      case "email":
        component = (
          <EmailInput
            value={value ?? ""}
            onChange={handleChange}
            readOnly={readOnly}
            multiple={multiple}
            required={required}
            placeholder={placeholder}
          />
        );
        break;

      case "select":
        component = (
          <Select
            value={value ?? ""}
            onChange={handleChange}
            options={options || []}
            {...extraProps}
          />
        );
        break;

      case "checkbox":
        component = (
          <Checkbox
            checked={!!value}
            onChange={handleChange}
            label={checkLabel || ""}
            {...extraProps}
          />
        );
        break;

      case "toggle":
        component = (
          <Toggle
            value={value ?? false}
            onChange={handleChange}
            readOnly={readOnly}
            triState={triState}
            colorOn={colorOn}
            colorOff={colorOff}
            labelOn={labelOn}
            labelOff={labelOff}
            labelNull={labelNull}
            {...extraProps}
          />
        );
        break;

      case "number":
        component = (
          <NumberInput
            value={value ?? 0}
            onChange={handleChange}
            readOnly={readOnly}
            scale={scaleOverride ?? colScales[name] ?? 2}
            placeholder={placeholder}
            {...extraProps}
          />
        );
        break;

      case "datepicker":
        component = (
          <DatePicker
            value={value ?? null}
            onChange={handleChange}
            readOnly={readOnly}
            mode={mode || (colType === "datetime" ? "datetime" : "date")}
            valueTo={valueTo}
            onChangeTo={onChangeTo}
            presets={presets}
            {...extraProps}
          />
        );
        break;

      case "lookup":
        component = (
          <Lookup
            value={value}
            onChange={handleChange}
            config={lookup!}
            label={label}
          />
        );
        break;

      default:
        component = (
          <Input
            value={value ?? ""}
            onChange={handleChange}
            readOnly={readOnly}
            {...extraProps}
          />
        );
    }

    return (
      <Field key={name} label={label} required={required}>
        {component}
      </Field>
    );
  }, [row, onChange, table, colTypes, colScales, t]);

  return field;
}

/** Convert snake_case to Title Case */
function humanize(key: string): string {
  return key
    .replace(/_id$/, "")
    .replace(/_nbr$/, " Number")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}
