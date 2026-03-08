// TabDef.ts — A single tab in a panel
// Contains an ordered list of child elements — no opinion about
// what they are (fields, sections, grids, anything).
// Pass-through: forwards display(row) to all children.

import type { ChildElement } from "./ChildElement";
import type { Row } from "./types";

export interface TabDefOptions {
  key: string;
  label?: string;
  hideLabel?: boolean;
  icon?: string;
  children?: any[];  // ChildElement[]
  hidden?: boolean;
  renderer?: string;
}

export class TabDef implements ChildElement {
  readonly type = "tab" as const;

  key: string;
  label: string = "";
  hideLabel: boolean = false;
  icon?: string;
  children: ChildElement[] = [];
  hidden: boolean = false;
  renderer?: string;
  hasError: boolean = false;

  constructor(options: TabDefOptions) {
    this.key = options.key;
    if (options.label     !== undefined) this.label     = options.label;
    if (options.hideLabel !== undefined) this.hideLabel = options.hideLabel;
    if (options.icon      !== undefined) this.icon      = options.icon;
    if (options.children  !== undefined) this.children  = options.children;
    if (options.hidden    !== undefined) this.hidden    = options.hidden;
    if (options.renderer  !== undefined) this.renderer  = options.renderer;
  }


  display(row: Row | null): void        { this.children.forEach(c => c.display(row)); }
  getField(key: string): any            { throw new Error("stub"); }
  getSection(key: string): any          { throw new Error("stub"); }
  getGrid(key: string): any             { throw new Error("stub"); }
  addChild(element: ChildElement): this { return this; } // stub
  removeChild(key: string): this        { return this; } // stub
}
