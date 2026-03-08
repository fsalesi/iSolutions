// ToolbarDef.ts — Owned by a PanelDef
// Sends semantic commands to the panel's datagrid.
// Does NOT own CRUD logic — it signals intent.


export interface ButtonDef {
  key: string;
  label: string;
  icon?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  requiresRecord?: boolean;
  hidden?: boolean;
  onClick: () => void;
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
  onRefresh: (() => void) | null = null;


  // Semantic commands — delegate to panel
  onNew():    void { this.panel?.newRecord(); }
  onSave():   void { this.panel?.save(); }
  onDelete(): void { this.panel?.deleteRecord(); }
  onCopy():   void { this.panel?.copyRecord(); }
  onAudit():  void { this.panel?.openAudit?.(); }

  addButton(button: ButtonDef): this  { this.buttons.push(button); return this; }
  getButton(key: string): ButtonDef   { const btn = this.buttons.find(b => b.key === key); if (!btn) throw new Error(`Button "${key}" not found`); return btn; }
  removeButton(key: string): this     { return this; } // stub
  refresh(): void                     { this.onRefresh?.(); }
}
