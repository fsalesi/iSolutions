import { SettingsEditPanel } from "@/platform/pages/settings/SettingsEditPanel";

export class FormSettingsEditPanel extends SettingsEditPanel {
  constructor(form?: any) {
    super(form);
    this.displayMode = "slide-in-right";
    this.title = "Form Setting";
    this.getField("form").defaultValue = undefined;
  }
}
