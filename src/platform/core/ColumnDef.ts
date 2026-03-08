// ColumnDef.ts — A single column in a DataGridDef

import { resolveClientText } from "@/lib/i18n/runtime";
import { tx, type TranslatableText } from "@/lib/i18n/types";
import type { RendererType } from "./types";

export interface ColumnDefOptions {
  key: string;
  label?: TranslatableText;
  renderer?: RendererType;
  hidden?: boolean;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortField?: string;
  dataType?: "string" | "number" | "date" | "datetime" | "boolean" | "decimal";
  precision?: number;
  alwaysRetrieve?: boolean;
  rendererOptions?: Record<string, any>;
  hideOnMobile?: boolean;
}

export class ColumnDef {
  key: string;
  label?: TranslatableText;
  translationScope?: string;

  renderer: RendererType = "text";
  hidden: boolean = false;
  width?: number;
  minWidth?: number;
  align?: "left" | "center" | "right";

  sortable: boolean = true;
  sortField?: string;

  dataType?: "string" | "number" | "date" | "datetime" | "boolean" | "decimal";
  precision?: number;

  // Include in API request even when column is hidden
  alwaysRetrieve: boolean = false;

  // Badge colors, format strings, etc.
  rendererOptions?: Record<string, any>;

  // Hide this column in mobile card view
  hideOnMobile: boolean = false;

  constructor(options: ColumnDefOptions) {
    this.key = options.key;
    if (options.label !== undefined) this.label = options.label;
    if (options.renderer         !== undefined) this.renderer         = options.renderer;
    if (options.hidden           !== undefined) this.hidden           = options.hidden;
    if (options.width            !== undefined) this.width            = options.width;
    if (options.minWidth         !== undefined) this.minWidth         = options.minWidth;
    if (options.align            !== undefined) this.align            = options.align;
    if (options.sortable         !== undefined) this.sortable         = options.sortable;
    if (options.sortField        !== undefined) this.sortField        = options.sortField;
    if (options.dataType         !== undefined) this.dataType         = options.dataType;
    if (options.precision        !== undefined) this.precision        = options.precision;
    if (options.alwaysRetrieve   !== undefined) this.alwaysRetrieve   = options.alwaysRetrieve;
    if (options.rendererOptions  !== undefined) this.rendererOptions  = options.rendererOptions;
    if (options.hideOnMobile       !== undefined) this.hideOnMobile      = options.hideOnMobile;
  }

  /** Apply a partial set of options — used by DataSourceDef to set canonical labels/renderers. */
  getLabel(): string {
    const fallback = typeof this.label === "string" && this.label.length > 0
      ? this.label
      : this.key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return this.translationScope
      ? resolveClientText(tx(`${this.translationScope}.columns.${this.key}`, fallback))
      : resolveClientText(this.label ?? fallback);
  }

  applyOptions(options: Partial<Omit<ColumnDefOptions, "key">>): this {
    if (options.label           !== undefined) this.label           = options.label;
    if (options.renderer        !== undefined) this.renderer        = options.renderer;
    if (options.hidden          !== undefined) this.hidden          = options.hidden;
    if (options.width           !== undefined) this.width           = options.width;
    if (options.minWidth        !== undefined) this.minWidth        = options.minWidth;
    if (options.align           !== undefined) this.align           = options.align;
    if (options.sortable        !== undefined) this.sortable        = options.sortable;
    if (options.sortField       !== undefined) this.sortField       = options.sortField;
    if (options.dataType        !== undefined) this.dataType        = options.dataType;
    if (options.precision       !== undefined) this.precision       = options.precision;
    if (options.alwaysRetrieve  !== undefined) this.alwaysRetrieve  = options.alwaysRetrieve;
    if (options.rendererOptions !== undefined) this.rendererOptions = options.rendererOptions;
    if (options.hideOnMobile     !== undefined) this.hideOnMobile     = options.hideOnMobile;
    return this;
  }
}