import { DataGridDef } from "@/platform/core/DataGridDef";
import { GroupDataSource } from "./GroupDataSource";

export class GroupGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "groups", pageSize: 0 }, form);
    this.dataSource = new GroupDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("group_id")?.applyOptions({ label: "Group ID", width: 160 });
    this.getColumn("description")?.applyOptions({ label: "Description" });
    this.getColumn("is_active")?.applyOptions({ label: "Active", renderer: "boolean", width: 80 });
  }
}
