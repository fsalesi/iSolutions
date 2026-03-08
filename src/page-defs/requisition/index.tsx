import { LayoutRenderer } from "@/components/layout/LayoutRenderer";
import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { RequisitionEditPanel } from "./RequisitionEditPanel";
import { RequisitionGrid } from "./RequisitionGrid";

/**
 * RequisitionPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class RequisitionPage extends PageDef {
  readonly formKey = "requisition";
  readonly title = "PO Reqs";

  protected grid      = new RequisitionGrid(this);
  protected editPanel = new RequisitionEditPanel(this);
  private   layout    = new HorizontalLayout("requisition", {
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

  show() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LayoutRenderer node={this.layout.root} />
      </div>
    );
  }
}
