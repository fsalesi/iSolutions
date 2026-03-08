import { DataGridDef } from "@/platform/core/DataGridDef";
import { SettingsDataSource } from "./SettingsDataSource";

export class SettingsGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "settings", pageSize: 0 }, form);
    this.dataSource = new SettingsDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    // oid is internal — hide it
    this.getColumn("oid").hidden = true;
  }
}
