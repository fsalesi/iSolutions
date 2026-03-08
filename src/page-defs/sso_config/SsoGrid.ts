import { DataGridDef } from "@/platform/core/DataGridDef";
import { SsoDataSource } from "./SsoDataSource";

/**
 * SsoGrid — SSO Configuration data grid.
 * SsoDataSource owns api, table, client_secret suppression, and canonical labels.
 * This grid just selects which columns to show in the browse view.
 */
export class SsoGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "sso_config" }, form);
    this.dataSource = new SsoDataSource();
  }

  async loadColumns() {
    await super.loadColumns();  // delegates to SsoDataSource.loadColumns()

    // scope is a technical detail — hide in the grid, still available in the edit panel
    this.getColumn("scope")?.applyOptions({ hidden: true });
  }
}
