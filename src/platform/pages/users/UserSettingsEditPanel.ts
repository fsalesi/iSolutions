import { FormLookup } from "@/components/lookup/presets/FormLookup";
import { SettingsEditPanel } from "@/platform/pages/settings/SettingsEditPanel";

export class UserSettingsEditPanel extends SettingsEditPanel {
  constructor(form?: any) {
    super(form);
    this.displayMode = "slide-in-right";
    this.title = "User Setting";

    this.getField("owner").defaultValue = undefined;

    const formField = this.getField("form");
    formField.hidden = false;
    formField.required = true;
    formField.renderer = "lookup";
    formField.lookupConfig = FormLookup();
  }
}
