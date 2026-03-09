import { DataGridDef } from "@/platform/core/DataGridDef";
import { RequisitionLinesDataSource } from "@customer/pages/requisition/RequisitionLinesDataSource";
import { RequisitionLinesEditPanel } from "@customer/pages/requisition/RequisitionLinesEditPanel";

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
