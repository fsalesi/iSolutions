import { SsoConfigPage as ProductSsoConfigPage } from "@/page-defs/sso_config";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";

/**
 * Customer layer — extends the product SsoConfigPage.
 * Demonstrates surgical override: rename Frank's Button and change its onClick.
 * No copy-paste, no forking — just what's different.
 */
export class SsoConfigPage extends ProductSsoConfigPage {
  constructor() {
    super(); // full product tree already wired

    // Override Frank's Button — wrap the original onClick with before/after messages
    const btn = this.editPanel.toolbar.getButton("franksButton");
    const superOnClick = btn.onClick;
    btn.onClick = () => {
      alert(resolveClientText(tx("sso_config.messages.before_franks_button", "Before Frank's Button")));
      superOnClick();
      alert(resolveClientText(tx("sso_config.messages.after_franks_button", "After Frank's Button")));
    };

    // Add a second customer-only button
    this.editPanel.toolbar.addButton({
      key:     "acmeButton",
      label:   tx("sso_config.actions.acme_button", "Acme's Button"),
      icon:    "building",
      onClick: () => alert(resolveClientText(tx("sso_config.messages.acme_button_clicked", "You've clicked Acme's button"))),
    });
  }
}
