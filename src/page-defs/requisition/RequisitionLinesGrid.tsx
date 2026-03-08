import { DataGridDef } from "@/platform/core/DataGridDef";
import { RequisitionLinesDataSource } from "./RequisitionLinesDataSource";

export class RequisitionLinesGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key: "requisition_lines",
      pageSize: 0,
      mode: "browse",
      allowSearch: false,
      showTitle: false,
      parentLink: {
        parentField: "oid",
        myField: "oid_requisition",
      },
    }, form);
    this.dataSource = new RequisitionLinesDataSource();
  }

  async loadColumns() {
    await super.loadColumns();

    // Hide audit columns we don't need in the child grid
    this.getColumn("created_at")?.applyOptions({ hidden: true });
    this.getColumn("created_by")?.applyOptions({ hidden: true });
    this.getColumn("updated_at")?.applyOptions({ hidden: true });
    this.getColumn("updated_by")?.applyOptions({ hidden: true });
    this.getColumn("domain")?.applyOptions({ hidden: true });
  }
}
