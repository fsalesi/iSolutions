/**
 * Requisition sub-components — Customer override barrel.
 *
 * All requisition grids, panels, and data sources re-exported here.
 * Override any class by replacing its re-export with a subclass.
 */

// ── Grids ─────────────────────────────────────────────────────────────
export { RequisitionGrid }             from "@/page-defs/requisition/RequisitionGrid";
export { RequisitionLinesGrid }        from "@/page-defs/requisition/RequisitionLinesGrid";

// ── Edit Panels ───────────────────────────────────────────────────────

import { RequisitionEditPanel as ProductRequisitionEditPanel } from "@/page-defs/requisition/RequisitionEditPanel";

export class RequisitionEditPanel extends ProductRequisitionEditPanel {
  constructor(form?: any) {
    super(form);
    this.headerRenderer = () => null;
    this.getTab("justification").hidden = true;
  }
}

export { RequisitionLinesEditPanel }   from "@/page-defs/requisition/RequisitionLinesEditPanel";

// ── Key Panel ─────────────────────────────────────────────────────────
export { RequisitionKeyPanel }         from "@/page-defs/requisition/RequisitionKeyPanel";

// ── Data Sources ──────────────────────────────────────────────────────

import { RequisitionDataSource as ProductRequisitionDataSource } from "@/page-defs/requisition/RequisitionDataSource";

export class RequisitionDataSource extends ProductRequisitionDataSource {
  constructor() {
    super();
    this.suppress("vendor_name");
    this.suppress("justification_note");
  }
}

export { RequisitionLinesDataSource }  from "@/page-defs/requisition/RequisitionLinesDataSource";
