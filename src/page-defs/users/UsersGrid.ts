import { DataGridDef } from "@/platform/core/DataGridDef";

/**
 * UsersGrid — Users data grid.
 */
export class UsersGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key:      "users",
      api:      "/api/users",
      table:    "users",
      pageSize: 0,
    }, form);
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("user_id").label         = "User ID";
    this.getColumn("is_active").renderer    = "boolean";
    this.getColumn("is_active").label       = "Active";
    this.getColumn("password_hash").hidden  = true;
    this.getColumn("photo").hidden          = true;
    this.getColumn("photo_type").hidden     = true;
    this.getColumn("custom_fields").hidden  = true;
    this.getColumn("domains").hidden        = true;
    this.getColumn("locale").hidden         = true;
    this.getColumn("street1").hidden        = true;
    this.getColumn("street2").hidden        = true;
    this.getColumn("city").hidden           = true;
    this.getColumn("state").hidden          = true;
    this.getColumn("postal_code").hidden    = true;
    this.getColumn("country").hidden        = true;
    this.getColumn("cell_phone").hidden     = true;
    this.getColumn("phone").hidden          = true;
    this.getColumn("employee_number").hidden = true;
    this.getColumn("expire_date").hidden    = true;
    this.getColumn("last_login").hidden     = true;
    this.getColumn("failed_logins").hidden  = true;
    this.getColumn("supervisor_id").hidden  = true;
    this.getColumn("delegate_id").hidden    = true;
    this.getColumn("approval_limit").hidden = true;
  }
}
