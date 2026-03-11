// SectionDef.ts — A grouped block of child elements
// Pass-through: forwards display(row) to all children.

import React from "react";
import type { ReactNode } from "react";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx, type TranslatableText } from "@/lib/i18n/types";
import type { ChildElement } from "./ChildElement";
import type { Row } from "./types";

export interface SectionDefOptions {
  key: string;
  label?: TranslatableText;
  hideLabel?: boolean;
  icon?: string;
  columns?: number;
  children?: any[];  // ChildElement[]
  hidden?: boolean;
  renderer?: string;
}

export class SectionDef implements ChildElement {
  readonly type = "section" as const;

  key: string;
  label: TranslatableText = "";
  hideLabel: boolean = false;
  icon?: string;
  columns: number = 2;      // field layout columns: 1 | 2 | 3 | 4
  children: ChildElement[] = [];
  hidden: boolean = false;
  renderer?: string;
  panel: any = null;

  constructor(options: SectionDefOptions) {
    this.key = options.key;
    if (options.label     !== undefined) this.label     = options.label;
    if (options.hideLabel !== undefined) this.hideLabel = options.hideLabel;
    if (options.icon      !== undefined) this.icon      = options.icon;
    if (options.columns   !== undefined) this.columns   = options.columns;
    if (options.children  !== undefined) this.children  = options.children;
    if (options.hidden    !== undefined) this.hidden    = options.hidden;
    if (options.renderer  !== undefined) this.renderer  = options.renderer;
  }


  getLabel(): string {
    const fallback = typeof this.label === "string" && this.label.length > 0
      ? this.label
      : this.key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if ((this as any)._panelLayoutLabelOverride && typeof this.label === "string" && this.label.length > 0) {
      return resolveClientText(this.label);
    }
    const formKey = this.panel?.form?.formKey ?? this.panel?.form?.key;
    return formKey
      ? resolveClientText(tx(`${formKey}.sections.${this.key}`, fallback))
      : resolveClientText(this.label || fallback);
  }

  // === LIFECYCLE METHODS ===

  show(options?: Record<string, unknown>): ReactNode {
    if (this.hidden) return null;
    // Lazy import to avoid circular dependency
    const { SectionRenderer } = require("@/components/panel/SectionRenderer");
    return React.createElement(SectionRenderer, { section: this, key: this.key, ...(options ?? {}) });
  }

  display(row: Row | null): void { this.children.forEach(c => c.display(row)); }

  hide(): void { /* stub */ }

  destroy(): void { /* stub */ }

  // === OTHER METHODS ===

  getField(key: string): any                        { throw new Error("stub"); }
  getGrid(key: string): any                         { throw new Error("stub"); }
  addChild(element: ChildElement): this             { return this; } // stub
  removeChild(key: string): this                    { return this; } // stub
}
