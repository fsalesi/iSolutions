import { DataGridDef } from "@/platform/core/DataGridDef";
import { RequisitionLinesDataSource, RequisitionLinesEditPanel } from "@customer/pages/requisition/components";

export class RequisitionLinesGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key: "requisition_lines",
      pageSize: 0,
      mode: "browse",
      allowSearch: true,
      showTitle: false,
    }, form);
    this.dataSource = new RequisitionLinesDataSource();
    this.panel = new RequisitionLinesEditPanel();
    this.panel.grid = this;  // Bidirectional reference
  }
}
