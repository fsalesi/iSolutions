import { DataSourceDef } from "@/platform/core/DataSourceDef";

export class FormsDataSource extends DataSourceDef {
  constructor() {
    super({ api: "/api/forms", table: "forms" });
    this.suppress("created_at", "created_by", "updated_at", "updated_by");
  }

  async loadColumns(): Promise<void> {
    await super.loadColumns();

    this.getColumn("form_key")?.applyOptions({ label: "Form Key" });
    this.getColumn("form_name")?.applyOptions({ label: "Form Name" });
    this.getColumn("description")?.applyOptions({ label: "Description" });
    this.getColumn("menu_category")?.applyOptions({ label: "Menu Category" });
    this.getColumn("has_approvals")?.applyOptions({ label: "Has Approvals", renderer: "boolean" });
    this.getColumn("custom_fields")?.applyOptions({ label: "Custom Fields" });
  }
}
