import { DataGridDef } from "@/platform/core/DataGridDef";
import { GroupDataSource } from "./GroupDataSource";

export class GroupGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "groups", pageSize: 0 }, form);
    this.dataSource = new GroupDataSource();
  }
}
