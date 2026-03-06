/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
/** Convert snake_case to Title Case */
export function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export const RENDERER_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text Area" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date/Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "lookup", label: "Lookup" },
  { value: "image", label: "Image" },
  { value: "password", label: "Password" },
  { value: "readonly", label: "Read-only" },
];

export const MANDATORY_OPTIONS = [
  { value: "false", label: "Never" },
  { value: "true", label: "Always" },
];

export const READONLY_OPTIONS = [
  { value: "false", label: "Never" },
  { value: "true", label: "Always" },
];
