// RequisitionLinesDataSource — single source of truth for the requisition_lines table.
// Column labels and types are applied once here; grids/lookups can still override.

import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class RequisitionLinesDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/requisition_lines", table: "requisition_lines" });

    this.suppress("custom_fields");
    this.suppress("oid_requisition"); // parent link field - internal
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("line_number")?.applyOptions({ label: "Line #", width: 70 });
    this.getColumn("part_number")?.applyOptions({ label: "Part #" });
    this.getColumn("description")?.applyOptions({ label: "Description" });
    this.getColumn("quantity")?.applyOptions({ label: "Qty", renderer: "number", width: 80 });
    this.getColumn("unit_cost")?.applyOptions({ label: "Unit Cost", renderer: "currency", width: 100 });
    this.getColumn("line_total")?.applyOptions({ label: "Total", renderer: "currency", width: 100 });
    this.getColumn("cost_center")?.applyOptions({ label: "Cost Center" });
    this.getColumn("gl_account")?.applyOptions({ label: "GL Account" });
  }
}
