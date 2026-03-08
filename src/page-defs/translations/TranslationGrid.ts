import { DataGridDef } from "@/platform/core/DataGridDef";
import { TranslationDataSource } from "./TranslationDataSource";

export class TranslationGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "translations", pageSize: 50 }, form);
    this.dataSource = new TranslationDataSource();
  }

  async loadColumns() {
    await super.loadColumns();
    this.getColumn("locale")?.applyOptions    ({ width: 100 });
    this.getColumn("namespace")?.applyOptions ({ width: 140 });
    this.getColumn("key")?.applyOptions       ({ width: 220 });
  }
}
