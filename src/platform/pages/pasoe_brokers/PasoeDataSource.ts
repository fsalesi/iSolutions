import { DataSourceDef } from "@/platform/core/DataSourceDef";

/**
 * PasoeDataSource — canonical source for pasoe_brokers.
 * Suppresses audit fields and custom_fields from all consumers.
 */
export class PasoeDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/pasoe_brokers", table: "pasoe_brokers" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by", "custom_fields");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();
    this.getColumn("name")?.applyOptions({ label: "Broker Name" });
    this.getColumn("domain")?.applyOptions({ label: "Domain" });
    this.getColumn("cacheable")?.applyOptions({ label: "Cacheable", renderer: "boolean" });
    this.getColumn("connect_string")?.applyOptions({ label: "Connect String" });
    this.getColumn("proxy_connect")?.applyOptions({ label: "Proxy Connect" });
  }
}
