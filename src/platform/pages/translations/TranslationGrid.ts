import { DataGridDef } from "@/platform/core/DataGridDef";
import { TranslationDataSource } from "./TranslationDataSource";

export class TranslationGrid extends DataGridDef {
  constructor(form?: any) {
    super({ key: "translations", pageSize: 50 }, form);
    this.dataSource = new TranslationDataSource();
  }
}
