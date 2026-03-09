// PanelDef.ts — Orchestrator of display, dirty tracking, and CRUD operations.
// Owns tabs, toolbar, and the current record.
// Cascades display(row) through the entire child tree.

import type { ReactNode } from "react";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { DataGridDef } from "./DataGridDef";
import type { FieldDef } from "./FieldDef";
import type { PageDef } from "./PageDef";
import type { SectionDef } from "./SectionDef";
import type { TabDef } from "./TabDef";
import type { Row, DisplayMode } from "./types";
import { AlertDialogService } from "./AlertDialogService";
import { DrawerService } from "./DrawerService";
import { ToolbarDef } from "./ToolbarDef";

type PanelForm = PageDef & {
  panels: PanelDef[];
  alertDialog: typeof AlertDialogService;
};

export class PanelDef {
  tabs: TabDef[] = [];
  toolbar: ToolbarDef = new ToolbarDef();

  currentRecord: Row | null = null;
  isDirty:       boolean = false;
  isNew:         boolean = false;
  displayNonce:  number  = 0;
  isCopyMode:    boolean = false;

  displayMode: DisplayMode = "inline";
  readOnly:    boolean = false;

  /** Title shown in drawer header (defaults to "Details") */
  title: string = "Details";

  grid: DataGridDef | null = null;

  // React callbacks — wired by the renderer
  onDisplay:      ((row: Row | null) => void) | null = null;
  private readonly displayListeners = new Set<(row: Row | null) => void>();

  /**
   * Header renderer — renders the panel header strip.
   * Default: KeyPanel (shows keyField=true fields).
   * Override in subclass constructor to customise.
   */
  headerRenderer: (props: { currentRecord: Row | null; isNew: boolean }) => ReactNode =
    ({ currentRecord, isNew }) => {
      const { KeyPanel } = require("@/components/panel/KeyPanel");
      return KeyPanel({ panel: this, currentRecord, isNew });
    };
  onFocusTab:     ((index: number) => void) | null = null;
  activeTabKey:   string = "";
  onDirtyChanged: ((dirty: boolean) => void) | null = null;

  private _form: PanelForm | null = null;
  get form(): PanelForm | null { return this._form; }
  set form(f: PanelForm | null) {
    this._form = f;
    if (f && !f.panels.includes(this)) f.panels.push(this);
  }

  private _initialized = false;

  constructor(form?: PanelForm) {
    this.toolbar.panel = this;
    if (form) this.form = form;
  }

  private get sections(): SectionDef[] {
    return this.tabs.flatMap(tab => tab.children.filter((child): child is SectionDef => child.type === "section"));
  }

  addDisplayListener(listener: (row: Row | null) => void): void {
    this.displayListeners.add(listener);
  }

  removeDisplayListener(listener: (row: Row | null) => void): void {
    this.displayListeners.delete(listener);
  }

  private notifyDisplay(row: Row | null): void {
    this.onDisplay?.(row);
    for (const listener of this.displayListeners) listener(row);
  }

  get fields(): FieldDef[] {
    return this.sections.flatMap(section => section.children.filter((child): child is FieldDef => child.type === "field"));
  }

  // —— Init ——————————————————————————————————————————————————————————
  // Walks the tree and stamps field.panel = this on every FieldDef.
  // Called lazily on first display() or newRecord().

  _init(): void {
    if (this._initialized) return;
    this._initialized = true;
    for (const tab of this.tabs) {
      (tab as any).panel = this;
    }
    for (const section of this.sections) {
      (section as any).panel = this;
    }
    for (const field of this.fields) {
      field.panel = this;
    }

    const stampChildren = (children: any[]) => {
      for (const child of children) {
        if (!child) continue;
        if (child.type === "grid") {
          child.ownerPanel = this;
          child._panelSource = this;
          if (!child.form && this.form) child.form = this.form;
        }
        if (Array.isArray(child.children)) {
          stampChildren(child.children);
        }
      }
    };

    for (const tab of this.tabs) {
      if (Array.isArray((tab as any).children)) {
        stampChildren((tab as any).children);
      }
    }
  }

  // —— Display ———————————————————————————————————————————————————————

  display(row: Row | null): void {
    this._init();

    // If this panel uses slide-in mode, push it onto the drawer stack
    if (this.displayMode === "slide-in-right") {
      DrawerService.push(this);
    }

    this.currentRecord = row;
    this.isNew = false;
    this.displayNonce++;
    this.tabs.forEach(tab => tab.display(row));
    this.notifyDisplay(row);
  }

  // —— Dirty tracking ————————————————————————————————————————————————

  setDirty(dirty: boolean): void {
    if (this.isDirty === dirty) return;
    this.isDirty = dirty;
    this.onDirtyChanged?.(dirty);
  }

  // —— New ———————————————————————————————————————————————————————————

  newRecord(): void {
    this._init();

    // If this panel uses slide-in mode, push it onto the drawer stack
    if (this.displayMode === "slide-in-right") {
      DrawerService.push(this);
    }

    this.currentRecord = null;
    this.isNew = true;
    // Walk fields — apply defaultValues, clear everything else
    for (const field of this.fields) {
      field.value = field.defaultValue ?? null;
      field.clearError?.();
    }
    this.setDirty(false);
    this.notifyDisplay(null);
  }

  // —— Validate ——————————————————————————————————————————————————————

  validate(): boolean {
    this._init();
    let valid = true;
    let firstFailingTabIndex = -1;

    for (let ti = 0; ti < this.tabs.length; ti++) {
      const tab = this.tabs[ti];
      tab.hasError = false;
      for (const section of tab.children.filter((child): child is SectionDef => child.type === "section")) {
        for (const field of section.children.filter((child): child is FieldDef => child.type === "field")) {
          field.clearError?.();
          if (field.required && (field.value === null || field.value === "" || field.value === undefined)) {
            field.showError?.(resolveClientText(tx("panel.validation.required", "{field} is required"), { field: field.getLabel() }));
            tab.hasError = true;
            valid = false;
            if (firstFailingTabIndex === -1) firstFailingTabIndex = ti;
          }
        }
      }
    }

    // Switch to first tab with errors so user can see them
    if (firstFailingTabIndex >= 0) {
      this.onFocusTab?.(firstFailingTabIndex);
    }

    return valid;
  }

  // —— Save ——————————————————————————————————————————————————————————

  async save(): Promise<void> {
    const api   = this.grid?.dataSource?.api;
    const table = this.grid?.dataSource?.table;
    if (!this.grid || !api || !table) {
      console.error("PanelDef.save: no grid.api or grid.table");
      return;
    }
    if (!this.validate()) return;

    // Collect field values
    const payload: Record<string, any> = { _table: table };
    for (const field of this.fields) {
      if (!field.readOnly) payload[field.key] = field.value;
    }

    // Child-grid saves need parent link fields (e.g., oid_requisition) even when
    // those fields are suppressed from the edit panel.
    this.applyParentBindingPayload(payload);

    // Include oid for PUT
    if (!this.isNew && this.currentRecord?.oid) {
      payload.oid = this.currentRecord.oid;
    }

    const method = this.isNew ? "POST" : "PUT";
    const res = await fetch(api, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[save] response status:", res.status, "data:", JSON.stringify(data));
    if (!res.ok) {
      this.showMessage(data.error ?? resolveClientText(tx("panel.save.failed", "Save failed")), "error");
      return;
    }

    // Refresh grid and re-display the saved row
    await this.grid.fetch();
    this.display(data);
    this.setDirty(false);
  }

  // —— Delete ————————————————————————————————————————————————————————

  private applyParentBindingPayload(payload: Record<string, any>): void {
    const parentFilter = this.grid?.parentFilter;
    if (!parentFilter || parentFilter.type !== "group") return;

    for (const node of parentFilter.children) {
      if (node.type !== "condition") continue;
      if (node.operator !== "eq") continue;
      if (!node.field) continue;
      if (payload[node.field] !== undefined && payload[node.field] !== null && payload[node.field] !== "") continue;
      payload[node.field] = node.value;
    }
  }

  async deleteRecord(): Promise<void> {
    const api   = this.grid?.dataSource?.api;
    const table = this.grid?.dataSource?.table;
    if (!this.grid || !api || !table) return;
    if (!this.currentRecord?.oid) return;

    // Build a meaningful record label from key fields
    const keyFields = this.fields.filter(f => f.keyField);
    const label = keyFields.map(f => this.currentRecord?.[f.key]).filter(Boolean).join(" / ")
                  || "this record";

    const confirmed = await (this.form?.alertDialog ?? AlertDialogService)
      .danger({
        title: resolveClientText(tx("panel.delete.title", "Delete Record")),
        message: resolveClientText(tx("panel.delete.confirm", "Delete {label}? This cannot be undone."), { label }),
        confirmLabel: resolveClientText(tx("common.actions.delete", "Delete")),
      });
    if (!confirmed) return;

    const qs = new URLSearchParams({ table, oid: this.currentRecord.oid });
    const res = await fetch(`${api}?${qs}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await this.form?.alertDialog.error(
        data.error ?? resolveClientText(tx("panel.delete.failed", "Delete failed.")),
        resolveClientText(tx("panel.delete.title", "Delete Record"))
      );
      return;
    }

    await this.grid.fetch();
    this.currentRecord = null;
    this.isNew = false;
    this.setDirty(false);
    this.notifyDisplay(null);
  }

  // —— Copy ——————————————————————————————————————————————————————————

  copyRecord(): void {
    if (!this.currentRecord) return;
    this.isCopyMode = true;
    this.isNew = true;
    // Seed fields from current record, skip key fields
    for (const field of this.fields) {
      field.value = field.keyField ? (field.defaultValue ?? null) : (this.currentRecord[field.key] ?? null);
      field.clearError?.();
    }
    this.setDirty(true);
    this.notifyDisplay(null);
  }

  // —— Helpers ———————————————————————————————————————————————————————

  showMessage(message: string, type: "info" | "error" | "warning" = "info"): void {
    if (type === "error") this.form?.alertDialog.error(message);
    else if (type === "warning") this.form?.alertDialog.warning({ title: resolveClientText(tx("common.warning.title", "Warning")), message });
    else this.form?.alertDialog.info(message);
  }

  canNavigateAway(): Promise<boolean> { return Promise.resolve(true); }

  // Flat addressable access — searches entire tree

  getField(key: string): FieldDef {
    const field = this.fields.find(f => f.key === key);
    if (!field) throw new Error(`Field "${key}" not found`);
    return field;
  }

  getTab(key: string): TabDef {
    const tab = this.tabs.find(t => t.key === key);
    if (!tab) throw new Error(`Tab "${key}" not found`);
    return tab;
  }

  getSection(key: string): SectionDef { throw new Error("stub"); }
  getGrid(key: string): DataGridDef { throw new Error("stub"); }
}
