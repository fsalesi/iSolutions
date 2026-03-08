// FieldDef.ts — A single field inside a section
// Implements ChildElement.

import type { ChildElement } from "./ChildElement";
import type { Row, RendererType, SelectOption } from "./types";

// Data-only options — no methods, safe to spread
export interface FieldDefOptions {
  key: string;
  label: string;
  renderer?: RendererType;
  lookupConfig?: any;
  options?: SelectOption[];
  scale?: number;
  required?: boolean;
  readOnly?: boolean;
  keyField?: boolean;
  maxLength?: number;
  valMessage?: string;
  hidden?: boolean;
  defaultValue?: any;
}

export class FieldDef implements ChildElement {
  readonly type = "field" as const;

  key: string;
  label: string;

  renderer: RendererType = "text";

  // Renderer-specific config
  lookupConfig?: any;        // LookupConfig — from lookup subsystem
  options?: SelectOption[];  // when renderer = "select"
  scale?: number;            // decimal places — when renderer = "number"

  // Validation — override backend schema defaults
  required?: boolean;
  readOnly?: boolean;
  keyField?: boolean;
  maxLength?: number;
  valMessage?: string;

  hidden: boolean = false;
  defaultValue?: any;

  panel: any = null;  // PanelDef back-reference — set by PanelDef._init()

  // Runtime state — set by display()
  value: any = null;
  hasError: boolean = false;
  errorMessage: string = "";

  constructor(options: FieldDefOptions) {
    this.key   = options.key;
    this.label = options.label;
    if (options.renderer    !== undefined) this.renderer    = options.renderer;
    if (options.lookupConfig !== undefined) this.lookupConfig = options.lookupConfig;
    if (options.options     !== undefined) this.options     = options.options;
    if (options.scale       !== undefined) this.scale       = options.scale;
    if (options.required    !== undefined) this.required    = options.required;
    if (options.readOnly    !== undefined) this.readOnly    = options.readOnly;
    if (options.keyField    !== undefined) this.keyField    = options.keyField;
    if (options.maxLength   !== undefined) this.maxLength   = options.maxLength;
    if (options.valMessage  !== undefined) this.valMessage  = options.valMessage;
    if (options.hidden        !== undefined) this.hidden        = options.hidden;
    if (options.defaultValue  !== undefined) this.defaultValue  = options.defaultValue;
  }


  display(row: Row | null): void  { this.value = row ? (row[this.key] ?? null) : null; }

  setValue(value: any): void {
    this.value = value;
    this.panel?.setDirty(true);
  }

  showError(message: string): void {
    this.hasError = true;
    this.errorMessage = message;
  }

  clearError(): void {
    this.hasError = false;
    this.errorMessage = "";
  }
}
