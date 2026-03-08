// TabDef.ts — A single tab in a panel
// Contains an ordered list of child elements — no opinion about
// what they are (fields, sections, grids, anything).
// Pass-through: forwards display(row) to all children.

import type { ReactNode } from "react";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx, type TranslatableText } from "@/lib/i18n/types";
import type { ChildElement } from "./ChildElement";
import type { Row } from "./types";

export interface TabDefOptions {
  key: string;
  label?: TranslatableText;
  hideLabel?: boolean;
  icon?: string;
  children?: any[];  // ChildElement[]
  hidden?: boolean;
  renderer?: string;
}

export class TabDef implements ChildElement {
  readonly type = "tab" as const;

  key: string;
  label: TranslatableText = "";
  hideLabel: boolean = false;
  icon?: string;
  children: ChildElement[] = [];
  hidden: boolean = false;
  renderer?: string;
  hasError: boolean = false;
  panel: any = null;

  constructor(options: TabDefOptions) {
    this.key = options.key;
    if (options.label     !== undefined) this.label     = options.label;
    if (options.hideLabel !== undefined) this.hideLabel = options.hideLabel;
    if (options.icon      !== undefined) this.icon      = options.icon;
    if (options.children  !== undefined) this.children  = options.children;
    if (options.hidden    !== undefined) this.hidden    = options.hidden;
    if (options.renderer  !== undefined) this.renderer  = options.renderer;
  }


  getLabel(): string {
    const fallback = typeof this.label === "string" && this.label.length > 0
      ? this.label
      : this.key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const formKey = this.panel?.form?.formKey ?? this.panel?.form?.key;
    return formKey
      ? resolveClientText(tx(`${formKey}.tabs.${this.key}`, fallback))
      : resolveClientText(this.label || fallback);
  }

  // === LIFECYCLE METHODS ===

  // Tabs don't render themselves — TabRenderer renders tab headers
  // and calls show() on the active tab's children.
  show(): ReactNode { return null; }

  display(row: Row | null): void { this.children.forEach(c => c.display(row)); }

  hide(): void { /* stub */ }

  destroy(): void { /* stub */ }

  // === OTHER METHODS ===

  getField(key: string): any            { throw new Error("stub"); }
  getSection(key: string): any          { throw new Error("stub"); }
  getGrid(key: string): any             { throw new Error("stub"); }
  addChild(element: ChildElement): this { return this; } // stub
  removeChild(key: string): this        { return this; } // stub
}
