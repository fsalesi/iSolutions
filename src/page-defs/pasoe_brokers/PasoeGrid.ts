import { DataGridDef } from "@/platform/core/DataGridDef";
import { PasoeDataSource } from "./PasoeDataSource";

/**
 * PasoeGrid — Browse grid for PASOE Brokers.
 */
export class PasoeGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "pasoe_brokers" }, form);
    this.dataSource = new PasoeDataSource();
  }

  async loadColumns() {
    await super.loadColumns();

    // Hide technical fields in the browse — visible in edit panel
    this.getColumn("proxy_connect").hidden = true;
  }
}
