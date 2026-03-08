import { DataGridDef } from "@/platform/core/DataGridDef";
import { TranslationDataSource } from "./TranslationDataSource";

export class TranslationGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "translations", pageSize: 50 }, form);
    this.dataSource = new TranslationDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("locale")?.applyOptions    ({ label: "Locale",    width: 100 });
    this.getColumn("namespace")?.applyOptions ({ label: "Namespace", width: 140 });
    this.getColumn("key")?.applyOptions       ({ label: "Key",       width: 220 });
    this.getColumn("value")?.applyOptions     ({ label: "Value" });
  }
}
