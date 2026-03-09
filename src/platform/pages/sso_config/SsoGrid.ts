import { DataGridDef } from "@/platform/core/DataGridDef";
import { SsoDataSource } from "./SsoDataSource";

/**
 * SsoGrid — SSO Configuration data grid.
 * SsoDataSource owns api, table, client_secret suppression, and canonical labels.
 */
export class SsoGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "sso_config" }, form);
    this.dataSource = new SsoDataSource();
  }
}
