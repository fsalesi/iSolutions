// ToolbarDef.ts — Owned by a PanelDef
// Sends semantic commands to the panel's datagrid.
// Does NOT own CRUD logic — it signals intent.

import type { TranslatableText } from "@/lib/i18n/types";

export interface ToolbarButtonClickContext {
  toolbar: ToolbarDef;
  button: ButtonDef;
  panel: any;
  form: any;
  currentRecord: any;
}

export type ToolbarButtonHandler = (context: ToolbarButtonClickContext) => unknown | Promise<unknown>;

export interface ToolbarButtonHandlerOption {
  key: string;
  label: string;
  description?: string;
  formKeys?: string[];
}

export interface ToolbarButtonSettings {
  requiresRecord?: boolean;
  disabledWhenNew?: boolean;
  disabledWhenDirty?: boolean;
  disabledWhenReadOnly?: boolean;
  hiddenWhenReadOnly?: boolean;
}

export interface ButtonDef {
  key: string;
  label: TranslatableText;
  icon?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  requiresRecord?: boolean;
  disabledWhenNew?: boolean;
  disabledWhenDirty?: boolean;
  disabledWhenReadOnly?: boolean;
  hiddenWhenReadOnly?: boolean;
  hidden?: boolean;
  sortOrder?: number;
  handler?: string;
  settings?: ToolbarButtonSettings;
  onClick?: ToolbarButtonHandler;
}

export function getToolbarButtonHandlerOptions(form: any): ToolbarButtonHandlerOption[] {
  const options = form?.toolbarButtonHandlerOptions;
  if (!Array.isArray(options)) return [];

  const formKey = form?.formKey ?? form?.key ?? "";
  return options.filter((option: ToolbarButtonHandlerOption) => {
    if (!option.formKeys || option.formKeys.length === 0) return true;
    return option.formKeys.includes("*") || option.formKeys.includes(formKey);
  });
}

export class ToolbarDef {
  panel: any = null; // PanelDef back-reference — set by PanelDef constructor

  // Built-in feature toggles
  useSave:   boolean = true;
  useDelete: boolean = true;
  useCopy:   boolean = true;
  useNew:    boolean = true;
  useNotes:  boolean = false;
  useAudit:  boolean = false;
  usePrint:  boolean = false;

  buttons:   ButtonDef[] = [];
  buttonSortOrder: Record<string, number> = {};
  onRefresh: (() => void) | null = null;

  // Semantic commands — delegate to panel
  onNew():    void { this.panel?.newRecord(); }
  onSave():   void { this.panel?.save(); }
  onDelete(): void { this.panel?.deleteRecord(); }
  onCopy():   void { this.panel?.copyRecord(); }
  onAudit():  void { this.panel?.openAudit?.(); }

  addButton(button: ButtonDef): this {
    const existing = this.buttons.find(b => b.key === button.key);
    if (existing) Object.assign(existing, button);
    else this.buttons.push(button);
    return this;
  }

  getButton(key: string): ButtonDef {
    const btn = this.buttons.find(b => b.key === key);
    if (!btn) throw new Error(`Button "${key}" not found`);
    return btn;
  }

  removeButton(key: string): this {
    const idx = this.buttons.findIndex(b => b.key === key);
    if (idx >= 0) this.buttons.splice(idx, 1);
    return this;
  }

  refresh(): void { this.onRefresh?.(); }

  private buildClickContext(button: ButtonDef): ToolbarButtonClickContext {
    return {
      toolbar: this,
      button,
      panel: this.panel,
      form: this.panel?.form ?? null,
      currentRecord: this.panel?.currentRecord ?? null,
    };
  }

  private resolveNamedHandler(handlerName: string): ToolbarButtonHandler | null {
    const form = this.panel?.form as Record<string, unknown> | undefined;
    const pageMethod = form?.[handlerName];
    if (typeof pageMethod === "function") {
      return (context: ToolbarButtonClickContext) => (pageMethod as ToolbarButtonHandler).call(form, context);
    }
    return null;
  }

  resolveHandler(button: ButtonDef): ToolbarButtonHandler | null {
    const handlerName = button.handler?.trim();
    if (handlerName) return this.resolveNamedHandler(handlerName);
    return button.onClick ?? null;
  }

  async clickButton(buttonOrKey: string | ButtonDef): Promise<void> {
    const button = typeof buttonOrKey === "string" ? this.getButton(buttonOrKey) : buttonOrKey;
    const handler = this.resolveHandler(button);
    if (!handler) {
      const name = button.handler?.trim() || button.key;
      this.panel?.showMessage?.(`No toolbar handler is registered for "${name}".`, "warning");
      return;
    }
    await handler(this.buildClickContext(button));
  }
}
