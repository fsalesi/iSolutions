import { DataGridDef } from "@/platform/core/DataGridDef";
import { FormsDataSource } from "./FormsDataSource";

export class FormsGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "forms", pageSize: 0 }, form);
    this.dataSource = new FormsDataSource();
  }
}
