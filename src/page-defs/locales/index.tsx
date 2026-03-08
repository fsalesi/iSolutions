import { LayoutRenderer } from "@/components/layout/LayoutRenderer";
import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { LocaleGrid } from "./LocaleGrid";
import { LocaleEditPanel } from "./LocaleEditPanel";

export class LocalesPage extends PageDef {
  readonly title   = "Locales";
  readonly formKey = "locales";

  protected grid      = new LocaleGrid(this);
  protected editPanel = new LocaleEditPanel(this);
  private   layout    = new HorizontalLayout("locales", {
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

  show() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LayoutRenderer node={this.layout.root} />
      </div>
    );
  }
}
