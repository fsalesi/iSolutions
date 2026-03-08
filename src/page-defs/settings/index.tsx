import { LayoutRenderer } from "@/components/layout/LayoutRenderer";
import { PageDef } from "@/platform/core/PageDef";
import { HorizontalLayout } from "@/platform/core/layouts";
import { SettingsGrid } from "./SettingsGrid";
import { SettingsEditPanel } from "./SettingsEditPanel";

/**
 * SystemSettingsPage — Product layer.
 * Layout: HorizontalLayout (left = grid, right = edit panel)
 */
export class SystemSettingsPage extends PageDef {
  readonly title   = "System Settings";
  readonly formKey = "settings";

  protected grid      = new SettingsGrid(this);
  protected editPanel = new SettingsEditPanel(this);
  private   layout    = new HorizontalLayout("settings", {
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

  show() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LayoutRenderer node={this.layout.root} />
      </div>
    );
  }
}
