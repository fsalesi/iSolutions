// PanelDef.ts — Orchestrator of display, dirty tracking, and CRUD operations.
// Owns tabs, toolbar, and the current record.
// Cascades display(row) through the entire child tree.

import type { Row, DisplayMode } from "./types";
import { ToolbarDef } from "./ToolbarDef";

export class PanelDef {
  tabs: any[] = [];  // TabDef[]
  toolbar: ToolbarDef = new ToolbarDef();

  currentRecord: Row | null = null;
  isDirty:       boolean = false;
  isNew:         boolean = false;
  isCopyMode:    boolean = false;

  displayMode: DisplayMode = "inline";
  readOnly:    boolean = false;

  grid: any = null;  // DataGridDef back-reference

  // React callbacks — wired by the renderer
  onDisplay:      ((row: Row | null) => void) | null = null;
  onFocusTab:     ((index: number) => void) | null = null;
  onDirtyChanged: ((dirty: boolean) => void) | null = null;

  private _form: any = null;
  get form(): any { return this._form; }
  set form(f: any) {
    this._form = f;
    if (f && !f.panels.includes(this)) f.panels.push(this);
  }

  private _initialized = false;

  constructor(form?: any) {
    this.toolbar.panel = this;
    if (form) this.form = form;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  // Walks the tree and stamps field.panel = this on every FieldDef.
  // Called lazily on first display() or newRecord().

  _init(): void {
    if (this._initialized) return;
    this._initialized = true;
    for (const tab of this.tabs) {
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type === "field") field.panel = this;
          }
        }
      }
    }
  }

  // ── Display ───────────────────────────────────────────────────────────────

  display(row: Row | null): void {
    this._init();
    this.currentRecord = row;
    this.isNew = false;
    this.tabs.forEach(tab => tab.display(row));
    this.onDisplay?.(row);
  }

  // ── Dirty tracking ────────────────────────────────────────────────────────

  setDirty(dirty: boolean): void {
    if (this.isDirty === dirty) return;
    this.isDirty = dirty;
    this.onDirtyChanged?.(dirty);
  }

  // ── New ───────────────────────────────────────────────────────────────────

  newRecord(): void {
    this._init();
    this.currentRecord = null;
    this.isNew = true;
    // Walk fields — apply defaultValues, clear everything else
    for (const tab of this.tabs) {
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type === "field") {
              field.value = field.defaultValue ?? null;
              field.clearError?.();
            }
          }
        }
      }
    }
    this.setDirty(false);
    this.onDisplay?.(null);
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  validate(): boolean {
    this._init();
    let valid = true;
    let firstFailingTabIndex = -1;

    for (let ti = 0; ti < this.tabs.length; ti++) {
      const tab = this.tabs[ti];
      tab.hasError = false;
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type !== "field") continue;
            field.clearError?.();
            if (field.required && (field.value === null || field.value === "" || field.value === undefined)) {
              field.showError?.(`${field.label} is required`);
              tab.hasError = true;
              valid = false;
              if (firstFailingTabIndex === -1) firstFailingTabIndex = ti;
            }
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

  // ── Save ──────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    const api   = this.grid?.api   ?? this.grid?.dataSource?.api;
    const table = this.grid?.table ?? this.grid?.dataSource?.table;
    if (!api || !table) {
      console.error("PanelDef.save: no grid.api or grid.table");
      return;
    }
    if (!this.validate()) return;

    // Collect field values
    const payload: Record<string, any> = { _table: table };
    for (const tab of this.tabs) {
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type === "field" && !field.readOnly) {
              payload[field.key] = field.value;
            }
          }
        }
      }
    }

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
      this.showMessage(data.error ?? "Save failed", "error");
      return;
    }

    // Refresh grid and re-display the saved row
    await this.grid.fetch();
    this.display(data);
    this.setDirty(false);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteRecord(): Promise<void> {
    const api   = this.grid?.dataSource?.api;
    const table = this.grid?.dataSource?.table;
    if (!api || !table) return;
    if (!this.currentRecord?.oid) return;
    if (!confirm("Delete this record?")) return;

    const qs = new URLSearchParams({ table, oid: this.currentRecord.oid });
    const res = await fetch(`${api}?${qs}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      this.showMessage(data.error ?? "Delete failed", "error");
      return;
    }

    await this.grid.fetch();
    this.currentRecord = null;
    this.isNew = false;
    this.setDirty(false);
    this.onDisplay?.(null);
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  copyRecord(): void {
    if (!this.currentRecord) return;
    this.isCopyMode = true;
    this.isNew = true;
    // Seed fields from current record, skip key fields
    for (const tab of this.tabs) {
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type === "field") {
              field.value = field.keyField ? (field.defaultValue ?? null) : (this.currentRecord![field.key] ?? null);
              field.clearError?.();
            }
          }
        }
      }
    }
    this.setDirty(true);
    this.onDisplay?.(null);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  showMessage(message: string, type: "info" | "error" | "warning" = "info"): void {
    // TODO: proper toast system — console for now
    if (type === "error") console.error(message);
    else console.log(message);
    alert(message);
  }

  canNavigateAway(): Promise<boolean> { return Promise.resolve(true); }

  // Flat addressable access — searches entire tree
  getField(key: string): any {
    for (const tab of this.tabs) {
      for (const child of tab.children ?? []) {
        if (child.type === "section") {
          for (const field of child.children ?? []) {
            if (field.type === "field" && field.key === key) return field;
          }
        }
      }
    }
    throw new Error(`Field "${key}" not found`);
  }

  getTab(key: string): any {
    const tab = this.tabs.find((t: any) => t.key === key);
    if (!tab) throw new Error(`Tab "${key}" not found`);
    return tab;
  }

  getSection(key: string): any { throw new Error("stub"); }
  getGrid(key: string): any    { throw new Error("stub"); }
}
