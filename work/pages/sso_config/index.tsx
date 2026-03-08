import { SsoConfigPage as ProductSsoConfigPage } from "@/page-defs/sso_config";

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
      alert("Before Frank's Button");
      superOnClick();
      alert("After Frank's Button");
    };

    // Add a second customer-only button
    this.editPanel.toolbar.addButton({
      key:     "acmeButton",
      label:   "Acme's Button",
      icon:    "building",
      onClick: () => alert("You've clicked Acme's button"),
    });
  }
}
