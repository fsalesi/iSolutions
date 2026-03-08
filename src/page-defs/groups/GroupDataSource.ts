import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class GroupDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/groups", table: "groups" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();
    this.getColumn("group_id")?.applyOptions({ label: "Group ID" });
    this.getColumn("description")?.applyOptions({ label: "Description" });
    this.getColumn("is_active")?.applyOptions({ label: "Active", renderer: "boolean" });
  }
}

