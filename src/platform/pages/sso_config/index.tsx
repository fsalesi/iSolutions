import { PageDef } from "@/platform/core/PageDef";
import { ThreePanelLayout } from "@/platform/core/layouts";
import { SsoGrid } from "./SsoGrid";
import { SsoEditPanel } from "./SsoEditPanel";
import { UsersGrid } from "@/platform/pages/users/UsersGrid";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";

/**
 * SsoConfigPage — Product layer.
 * Extends PageDef — inherits grid/panel registries and wire().
 *
 * Layout: ThreePanelLayout
 *   topLeft    → SsoGrid
 *   bottomLeft → (reserved)
 *   right      → SsoEditPanel
 */
export class SsoConfigPage extends PageDef {
  readonly title   = "SSO Configuration";
  readonly formKey = "sso_config";

  protected grid      = new SsoGrid(this);
  protected editPanel = new SsoEditPanel(this);
  protected usersGrid = new UsersGrid(this);
  protected layout    = new ThreePanelLayout("sso_config", {
    outerSizes: [80, 20],
    innerSizes: [60, 40],
  });

  constructor() {
    super();

    // Cross-wire grid ↔ panel (registration happened at construction via new SsoGrid(this))
    this.grid.panel     = this.editPanel;
    this.editPanel.grid = this.grid;

    this.layout.topLeft.content    = this.grid;
    this.layout.bottomLeft.content = this.usersGrid;
    this.layout.right.content      = this.editPanel;

    this.editPanel.toolbar.addButton({
      key:     "franksButton",
      label:   tx("sso_config.actions.franks_button", "Frank's Button"),
      icon:    "star",
      onClick: async () => {
        await this.alertDialog.info(resolveClientText(tx("sso_config.messages.franks_button_clicked", "You've clicked Frank's button")), resolveClientText(tx("sso_config.messages.test_title", "Test")));
      },
    });
  }
}

class Placeholder {
  constructor(private label: string) {}
  show() {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)", fontSize: "0.8rem", fontStyle: "italic",
      }}>
        {this.label}
      </div>
    );
  }
}
