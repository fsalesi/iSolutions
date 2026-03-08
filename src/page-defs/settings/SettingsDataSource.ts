import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class SettingsDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/settings", table: "settings" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();
    this.getColumn("setting_name")?.applyOptions({ label: "Setting Name" });
    this.getColumn("owner")?.applyOptions({ label: "Owner" });
    this.getColumn("domain")?.applyOptions({ label: "Domain" });
    this.getColumn("form")?.applyOptions({ label: "Form" });
    this.getColumn("value")?.applyOptions({ label: "Value" });
    this.getColumn("help_text")?.applyOptions({ label: "Help Text" });
  }
}
