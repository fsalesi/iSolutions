import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class SettingsDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/settings", table: "settings" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }
}
