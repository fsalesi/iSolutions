import { DataGridDef } from "@/platform/core/DataGridDef";

/**
 * SsoGrid — SSO Configuration data grid.
 * Extends DataGridDef — inherits all grid behaviour, events, and render().
 *
 * loadColumns() calls super to auto-discover, then customizes per-column.
 */
export class SsoGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key:   "sso_config",
      api:   "/api/sso_config",
      table: "sso_config",
    }, form);
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("scope").hidden        = true;
    this.getColumn("client_secret").width = 200;
    this.getColumn("label").label         = "Provider Name";
  }
}
