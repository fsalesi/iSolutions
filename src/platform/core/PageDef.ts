// PageDef.ts — Root of the form tree.
// Holds flat registries of all panels and grids in the page.
// Nodes self-register by setting their own `form` property:
//   myGrid.form  = this  → auto-pushes into this.grids[]
//   myPanel.form = this  → auto-pushes into this.panels[]
//
// Cross-wiring is plain assignment — no special method needed:
//   myGrid.panel = myPanel;
//   myPanel.grid = myGrid;
//
// From anywhere 7 levels deep:
//   this.form.getPanel("ssoEdit").getField("client_id").value
//   this.form.getGrid("sso_config").rows

import type { PanelDef } from "./PanelDef";
import type { DataGridDef } from "./DataGridDef";
import { AlertDialogService } from "./AlertDialogService";

export class PageDef {
  /** Call from anywhere in the form tree: await this.form.alertDialog.danger({ title, message }) */
  readonly alertDialog = AlertDialogService;

  /** The form key — e.g. "sso_config". Matches the page route. */
  key: string = "";

  /** Flat registry — populated automatically when node.form = this */
  readonly panels: PanelDef[] = [];
  readonly grids:  DataGridDef[] = [];

  getPanel(key?: string): PanelDef {
    if (!key) {
      if (this.panels.length === 0) throw new Error("No panels registered");
      return this.panels[0];
    }
    const p = this.panels.find(p => (p as any).key === key);
    if (!p) throw new Error(`Panel "${key}" not found`);
    return p;
  }

  getGrid(key?: string): DataGridDef {
    if (!key) {
      if (this.grids.length === 0) throw new Error("No grids registered");
      return this.grids[0];
    }
    const g = this.grids.find(g => g.key === key);
    if (!g) throw new Error(`Grid "${key}" not found`);
    return g;
  }
}
