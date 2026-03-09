import { DataGridDef } from "@/platform/core/DataGridDef";
import { LocaleDataSource } from "./LocaleDataSource";

export class LocaleGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "locales", pageSize: 0 }, form);
    this.dataSource = new LocaleDataSource();
  }
}
