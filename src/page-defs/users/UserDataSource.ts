// UserDataSource — single source of truth for the users table.
// Suppresses columns that no consumer (grid, lookup, browse modal) should ever see.
// Column labels and types are applied once here; grids/lookups can still override.

import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class UserDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/users", table: "users" });

    this.suppress("password_hash");
    this.suppress("photo");
    this.suppress("photo_type");
    this.suppress("custom_fields");
    this.suppress("failed_logins");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("user_id")?.applyOptions({ label: "User ID" });
    this.getColumn("full_name")?.applyOptions({ label: "Full Name" });
    this.getColumn("email")?.applyOptions({ label: "Email" });
    this.getColumn("title")?.applyOptions({ label: "Title" });
    this.getColumn("company")?.applyOptions({ label: "Company" });
    this.getColumn("domains")?.applyOptions({ label: "Domains" });
    this.getColumn("phone")?.applyOptions({ label: "Phone" });
    this.getColumn("cell_phone")?.applyOptions({ label: "Cell Phone" });
    this.getColumn("street1")?.applyOptions({ label: "Street 1" });
    this.getColumn("street2")?.applyOptions({ label: "Street 2" });
    this.getColumn("city")?.applyOptions({ label: "City" });
    this.getColumn("state")?.applyOptions({ label: "State" });
    this.getColumn("postal_code")?.applyOptions({ label: "Postal Code" });
    this.getColumn("country")?.applyOptions({ label: "Country" });
    this.getColumn("locale")?.applyOptions({ label: "Locale" });
    this.getColumn("is_active")?.applyOptions({ label: "Active", renderer: "boolean" });
    this.getColumn("supervisor_id")?.applyOptions({ label: "Supervisor" });
    this.getColumn("delegate_id")?.applyOptions({ label: "Delegate" });
    this.getColumn("approval_limit")?.applyOptions({ label: "Approval Limit", renderer: "currency" });
    this.getColumn("expire_date")?.applyOptions({ label: "Expire Date", renderer: "dateDisplay" });
    this.getColumn("last_login")?.applyOptions({ label: "Last Login", renderer: "dateDisplay" });
    this.getColumn("employee_number")?.applyOptions({ label: "Employee #" });
  }
}
