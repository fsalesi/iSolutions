import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class GroupDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/groups", table: "groups" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }
}

