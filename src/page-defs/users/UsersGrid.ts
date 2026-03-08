import { DataGridDef } from "@/platform/core/DataGridDef";
import { UserDataSource } from "./UserDataSource";

/**
 * UsersGrid — Users data grid.
 * DataSource owns suppression of password_hash, photo, etc. and canonical labels.
 * This grid just selects which columns are visible by default.
 */
export class UsersGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "users", pageSize: 0 }, form);
    this.dataSource = new UserDataSource();
  }

  async loadColumns() {
    await super.loadColumns();  // delegates to dataSource.loadColumns()

    // Columns suppressed at datasource level (password_hash, photo, etc.) never appear.
    // Hide columns that exist but aren't useful in the browse grid by default.
    this.getColumn("domains").hidden         = true;
    this.getColumn("locale").hidden          = true;
    this.getColumn("street1").hidden         = true;
    this.getColumn("street2").hidden         = true;
    this.getColumn("city").hidden            = true;
    this.getColumn("state").hidden           = true;
    this.getColumn("postal_code").hidden     = true;
    this.getColumn("country").hidden         = true;
    this.getColumn("cell_phone").hidden      = true;
    this.getColumn("phone").hidden           = true;
    this.getColumn("employee_number").hidden = true;
    this.getColumn("expire_date").hidden     = true;
    this.getColumn("last_login").hidden      = true;
    this.getColumn("supervisor_id").hidden   = true;
    this.getColumn("delegate_id").hidden     = true;
    this.getColumn("approval_limit").hidden  = true;
  }
}
