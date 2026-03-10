/**
 * Requisition sub-components — Customer override barrel.
 *
 * All requisition grids, panels, and data sources re-exported here.
 * Override any class by replacing its re-export with a subclass.
 */

import type {
  ToolbarButtonClickContext,
  ToolbarButtonHandler,
  ToolbarButtonHandlerOption,
} from "@/platform/core/ToolbarDef";

export const requisitionToolbarButtonHandlerOptions: ToolbarButtonHandlerOption[] = [
  {
    key: "sayHello",
    label: "Say Hello",
    description: "Demo handler that shows a hello dialog.",
    formKeys: ["requisition"],
  },
  {
    key: "showCurrentRecord",
    label: "Show Current Record",
    description: "Demo handler that displays the selected record payload.",
    formKeys: ["requisition"],
  },
];

export const requisitionToolbarButtonHandlers: Record<string, ToolbarButtonHandler> = {
  sayHello(this: { alertDialog?: { info?: (message: string, title?: string) => void } }) {
    this.alertDialog?.info?.("Hello from work/pages/requisition/components.ts", "Toolbar Handler");
  },

  showCurrentRecord(
    this: { alertDialog?: { info?: (message: string, title?: string) => void } },
    { currentRecord }: ToolbarButtonClickContext
  ) {
    const message = currentRecord
      ? JSON.stringify(currentRecord, null, 2)
      : "No record is currently selected.";

    this.alertDialog?.info?.(message, "Current Record");
  },
};

// ── Grids ───────────────────────────────────────────────────────────────────
export { RequisitionGrid }             from "@/page-defs/requisition/RequisitionGrid";
export { RequisitionLinesGrid }        from "@/page-defs/requisition/RequisitionLinesGrid";

// ── Edit Panels ─────────────────────────────────────────────────────────────

import { RequisitionEditPanel as ProductRequisitionEditPanel } from "@/page-defs/requisition/RequisitionEditPanel";

export class RequisitionEditPanel extends ProductRequisitionEditPanel {
  constructor(form?: any) {
    super(form);
//    this.headerRenderer = () => null;
    this.getTab("justification").hidden = true;
  }
}

export { RequisitionLinesEditPanel }   from "@/page-defs/requisition/RequisitionLinesEditPanel";

// ── Key Panel ───────────────────────────────────────────────────────────────
export { RequisitionKeyPanel }         from "@/page-defs/requisition/RequisitionKeyPanel";

// ── Data Sources ────────────────────────────────────────────────────────────

import { RequisitionDataSource as ProductRequisitionDataSource } from "@/page-defs/requisition/RequisitionDataSource";

export class RequisitionDataSource extends ProductRequisitionDataSource {
  constructor() {
    super();
    this.suppress("vendor_name");
    this.suppress("justification_note");
  }
}

export { RequisitionLinesDataSource }  from "@/page-defs/requisition/RequisitionLinesDataSource";
