import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { LocaleGrid } from "./LocaleGrid";
import { LocaleEditPanel } from "./LocaleEditPanel";

export class LocalesPage extends PageDef {
  readonly title   = "Locales";
  readonly formKey = "locales";

  protected grid      = new LocaleGrid(this);
  protected editPanel = new LocaleEditPanel(this);
  protected layout    = new HorizontalLayout("locales", {
    sizes:    [35, 65],
    minSizes: [200, 300],
  });

  constructor() {
    super();
    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;
    this.layout.left.content  = this.grid;
    this.layout.right.content = this.editPanel;
  }
}
