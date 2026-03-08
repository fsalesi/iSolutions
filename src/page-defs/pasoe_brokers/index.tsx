import { LayoutRenderer }  from "@/components/layout/LayoutRenderer";
import { PageDef }         from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { PasoeGrid }       from "./PasoeGrid";
import { PasoeEditPanel }  from "./PasoeEditPanel";
import type { Renderable } from "@/platform/core/LayoutNode";

/**
 * PasoeBrokersPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class PasoeBrokersPage extends PageDef implements Renderable {
  readonly title   = "PASOE Brokers";
  readonly formKey = "pasoe_brokers";

  protected grid      = new PasoeGrid(this);
  protected editPanel = new PasoeEditPanel(this);
  private   layout    = new HorizontalLayout("pasoe_brokers", {
    sizes:    [55, 45],
    minSizes: [200, 300],
  });

  constructor() {
    super();

    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;

    this.layout.left.content  = this.grid;
    this.layout.right.content = this.editPanel;
  }

  render() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LayoutRenderer node={this.layout.root} />
      </div>
    );
  }
}
