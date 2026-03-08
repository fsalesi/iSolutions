import { LayoutRenderer } from "@/components/layout/LayoutRenderer";
import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { UsersGrid } from "./UsersGrid";
import { UsersEditPanel } from "./UsersEditPanel";
import type { Renderable } from "@/platform/core/LayoutNode";

/**
 * UsersPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class UsersPage extends PageDef implements Renderable {
  readonly title   = "Users";
  readonly formKey = "users";

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

  render() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LayoutRenderer node={this.layout.root} />
      </div>
    );
  }
}
