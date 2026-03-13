import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { FormsEditPanel } from "./FormsEditPanel";
import { FormsGrid } from "./FormsGrid";

export class FormsPage extends PageDef {
  readonly title = "Forms";
  readonly formKey = "forms";

  protected grid = new FormsGrid(this);
  protected editPanel = new FormsEditPanel(this);
  protected layout = new HorizontalLayout("forms", {
    sizes: [35, 65],
    minSizes: [200, 300],
  });

  constructor() {
    super();
    this.grid.panel = this.editPanel;
    this.editPanel.grid = this.grid;
    this.layout.left.content = this.grid;
    this.layout.right.content = this.editPanel;
  }
}
