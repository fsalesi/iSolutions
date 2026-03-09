import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { UsersEditPanel } from "./UsersEditPanel";
import { UsersGrid } from "./UsersGrid";

/**
 * UsersPage — Platform page (admin/system table).
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 *
 * Platform pages use direct imports — no @customer override chain
 * for sub-components. Customer can still override the page itself
 * via work/pages/users/index.tsx.
 */
export class UsersPage extends PageDef {
  readonly formKey = "users";
  readonly title = "Users";

  protected grid      = new UsersGrid(this);
  protected editPanel = new UsersEditPanel(this);
  protected layout    = new HorizontalLayout("users", {
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
}
