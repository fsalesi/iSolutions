import { LayoutRenderer } from "@/components/layout/LayoutRenderer";
import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { UsersEditPanel } from "./UsersEditPanel";
import { UsersGrid } from "./UsersGrid";

/**
 * UsersPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class UsersPage extends PageDef {
  readonly formKey = "users";
  readonly title = "Users";

  protected grid      = new UsersGrid(this);
  protected editPanel = new UsersEditPanel(this);
  private   layout    = new HorizontalLayout("users", {
    sizes:    [60, 40],
    minSizes: [200, 280],
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
