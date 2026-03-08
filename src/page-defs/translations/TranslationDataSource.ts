import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class TranslationDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/translations", table: "translations" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();
    this.getColumn("locale")?.applyOptions    ({ label: "Locale" });
    this.getColumn("namespace")?.applyOptions ({ label: "Namespace" });
    this.getColumn("key")?.applyOptions       ({ label: "Key" });
    this.getColumn("value")?.applyOptions     ({ label: "Value" });
  }
}
