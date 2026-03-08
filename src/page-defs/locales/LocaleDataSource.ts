import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class LocaleDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/locales", table: "locales" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("code")?.applyOptions        ({ label: "Code" });
    this.getColumn("description")?.applyOptions  ({ label: "Description" });
    this.getColumn("date_format")?.applyOptions  ({ label: "Date Format" });
    this.getColumn("decimal_char")?.applyOptions ({ label: "Decimal Char" });
    this.getColumn("separator_char")?.applyOptions({ label: "Separator Char" });
    this.getColumn("is_default")?.applyOptions   ({ label: "Default", renderer: "boolean" });
    this.getColumn("flag_svg")?.applyOptions     ({ label: "Flag", renderer: "svg" });
  }
}
