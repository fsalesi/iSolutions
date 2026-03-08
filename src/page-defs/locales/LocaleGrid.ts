import { DataGridDef } from "@/platform/core/DataGridDef";
import { LocaleDataSource } from "./LocaleDataSource";

export class LocaleGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "locales", pageSize: 0 }, form);
    this.dataSource = new LocaleDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("code")?.applyOptions        ({ label: "Code",      width: 120 });
    this.getColumn("description")?.applyOptions ({ label: "Description" });
    this.getColumn("is_default")?.applyOptions  ({ label: "Default",   renderer: "boolean", width: 80 });
  }
}
