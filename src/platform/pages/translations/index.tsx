import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { TranslationGrid } from "./TranslationGrid";
import { TranslationEditPanel } from "./TranslationEditPanel";

export class TranslationsPage extends PageDef {
  readonly title   = "Translations";
  readonly formKey = "translations";

  protected grid      = new TranslationGrid(this);
  protected editPanel = new TranslationEditPanel(this);
  protected layout    = new HorizontalLayout("translations", {
    sizes:    [55, 45],
    minSizes: [300, 280],
  });

  constructor() {
    super();
    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;
    this.layout.left.content  = this.grid;
    this.layout.right.content = this.editPanel;
  }
}
