import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { RequisitionGrid } from "@customer/pages/requisition/RequisitionGrid";
import { RequisitionEditPanel } from "@customer/pages/requisition/RequisitionEditPanel";

/**
 * RequisitionPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class RequisitionPage extends PageDef {
  readonly formKey = "requisition";
  readonly title = "PO Reqs";

  protected grid      = new RequisitionGrid(this);
  protected editPanel = new RequisitionEditPanel(this);
  protected layout    = new HorizontalLayout("requisition", {
    sizes:    [45, 55],
    minSizes: [280, 320],
  });

  constructor() {
    super();

    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;

    this.layout.left.content  = this.grid;
    this.layout.right.content = this.editPanel;
  }
}
