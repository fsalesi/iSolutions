// SsoDataSource — column catalogue for the sso_config table.

import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class SsoDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/sso_config", table: "sso_config" });

    // client_secret is sensitive — no consumer ever sees it in a grid or lookup
    this.suppress("client_secret");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("provider_id")?.applyOptions      ({ label: "Provider ID" });
    this.getColumn("label")?.applyOptions             ({ label: "Provider Name" });
    this.getColumn("is_active")?.applyOptions         ({ label: "Active",         renderer: "boolean" });
    this.getColumn("show_on_login")?.applyOptions     ({ label: "Show on Login",   renderer: "boolean" });
    this.getColumn("client_id")?.applyOptions         ({ label: "Client ID" });
    this.getColumn("authorization_url")?.applyOptions ({ label: "Auth URL" });
    this.getColumn("token_url")?.applyOptions         ({ label: "Token URL" });
    this.getColumn("logoff_url")?.applyOptions        ({ label: "Logoff URL" });
    this.getColumn("scope")?.applyOptions             ({ label: "Scope" });
  }
}
