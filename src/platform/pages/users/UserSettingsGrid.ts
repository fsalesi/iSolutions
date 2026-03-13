import { DataGridDef } from "@/platform/core/DataGridDef";
import { SettingsDataSource } from "@/platform/pages/settings/SettingsDataSource";
import { UserSettingsEditPanel } from "./UserSettingsEditPanel";

class UserSettingsDataSource extends SettingsDataSource {
  constructor() {
    super();
    this.suppress("owner");
  }
}

export class UserSettingsGrid extends DataGridDef {
  constructor(form?: any) {
    super({
      key: "user_settings",
      pageSize: 0,
      mode: "browse",
      allowSearch: true,
      showTitle: false,
      disabledWhenNew: true,
      disabledWhenDirty: true,
    }, form);

    this.dataSource = new UserSettingsDataSource();
    this.panel = new UserSettingsEditPanel(form);
    this.panel.grid = this;
    this.sort = ["form", "setting_name"];
    this.sortDirection = ["ASC", "ASC"];
  }
}
