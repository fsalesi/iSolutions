import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class LocaleDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/locales", table: "locales" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }
}
