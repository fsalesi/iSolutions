import { DataGridDef } from "@/platform/core/DataGridDef";
import { GroupDataSource } from "./GroupDataSource";

export class GroupGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "groups", pageSize: 0 }, form);
    this.dataSource = new GroupDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("group_id")?.applyOptions({ width: 160 });
    this.getColumn("is_active")?.applyOptions({ width: 80 });
  }
}
