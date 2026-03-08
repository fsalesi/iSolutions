// UserDataSource — single source of truth for the users table.
// Suppresses columns that no consumer (grid, lookup, browse modal) should ever see.
// Column labels and types are applied once here; grids/lookups can still override.

import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class UserDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/users", table: "users" });

    // Permanently hidden — never visible to any grid or lookup
    this.suppress("password_hash");
    this.suppress("photo");
    this.suppress("photo_type");
    this.suppress("custom_fields");
    this.suppress("failed_logins");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    // Apply canonical labels and renderers once — all consumers inherit these
    this.getColumn("user_id")?.applyOptions       ({ label: "User ID" });
    this.getColumn("full_name")?.applyOptions      ({ label: "Name" });
    this.getColumn("is_active")?.applyOptions      ({ label: "Active",    renderer: "boolean" });
    this.getColumn("supervisor_id")?.applyOptions  ({ label: "Supervisor" });
    this.getColumn("delegate_id")?.applyOptions    ({ label: "Delegate" });
    this.getColumn("approval_limit")?.applyOptions ({ label: "Approval Limit", renderer: "currency" });
    this.getColumn("expire_date")?.applyOptions    ({ label: "Expires",   renderer: "dateDisplay" });
    this.getColumn("last_login")?.applyOptions     ({ label: "Last Login", renderer: "dateDisplay" });
    this.getColumn("employee_number")?.applyOptions({ label: "Employee #" });
  }
}

/** Active users only — for supervisor, delegate, buyer fields */
export class ActiveUserDataSource extends UserDataSource {
  constructor() {
    super();
    this.baseFilters = { is_active: true };
  }
}
