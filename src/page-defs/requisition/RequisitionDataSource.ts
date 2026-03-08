// RequisitionDataSource — single source of truth for the requisition table.
// Suppresses columns that no consumer (grid, lookup, browse modal) should ever see.
// Column labels and types are applied once here; grids/lookups can still override.

import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class RequisitionDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/requisition", table: "requisition" });

    this.suppress("custom_fields");
    this.suppress("copied_from");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("req_number")?.applyOptions({ label: "Req #" });
    this.getColumn("description")?.applyOptions({ label: "Description" });
    this.getColumn("req_type")?.applyOptions({ label: "Type" });
    this.getColumn("status")?.applyOptions({ label: "Status" });
    this.getColumn("vendor_code")?.applyOptions({ label: "Vendor" });
    this.getColumn("buyer")?.applyOptions({ label: "Buyer" });
    this.getColumn("created_by")?.applyOptions({ label: "Created By" });
    this.getColumn("created_by_name")?.applyOptions({ label: "Created By" });
    this.getColumn("buyer_name")?.applyOptions({ label: "Buyer" });
    this.getColumn("total_amount")?.applyOptions({ label: "Total", renderer: "currency" });
    this.getColumn("need_date")?.applyOptions({ label: "Need Date", renderer: "dateDisplay" });
    this.getColumn("created_at")?.applyOptions({ label: "Created", renderer: "dateDisplay" });
    this.getColumn("submitted_at")?.applyOptions({ label: "Submitted", renderer: "dateDisplay" });
    this.getColumn("approved_at")?.applyOptions({ label: "Approved", renderer: "dateDisplay" });
    this.getColumn("is_urgent")?.applyOptions({ label: "Urgent", renderer: "boolean" });
    this.getColumn("is_change_order")?.applyOptions({ label: "Change Order", renderer: "boolean" });
    this.getColumn("justification_note")?.applyOptions({ label: "Justification" });
    this.getColumn("submitted_by")?.applyOptions({ label: "Submitted By" });
    this.getColumn("approved_by")?.applyOptions({ label: "Approved By" });
  }
}
