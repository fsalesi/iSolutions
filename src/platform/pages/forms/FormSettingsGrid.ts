import { DataGridDef } from "@/platform/core/DataGridDef";
import { SettingsDataSource } from "@/platform/pages/settings/SettingsDataSource";
import { FormSettingsEditPanel } from "./FormSettingsEditPanel";

class FormSettingsDataSource extends SettingsDataSource {
  constructor() {
    super();
    this.suppress("owner", "form");
  }
}

export class FormSettingsGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key: "form_settings",
      pageSize: 0,
      mode: "browse",
      allowSearch: true,
      showTitle: false,
      disabledWhenNew: true,
      disabledWhenDirty: true,
    }, form);

    this.dataSource = new FormSettingsDataSource();
    this.panel = new FormSettingsEditPanel(form);
    this.panel.grid = this;
    this.sort = ["setting_name"];
    this.sortDirection = ["ASC"];
  }
}
