import { EditPanel } from "@/platform/core/EditPanel";
import { FieldDef } from "@/platform/core/FieldDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { TabDef } from "@/platform/core/TabDef";
import { FormSettingsGrid } from "./FormSettingsGrid";

export class FormsEditPanel extends EditPanel {
  settingsGrid = new FormSettingsGrid();

  constructor(form?: any) {
    super({ useAudit: true }, form);

    this.tabs = [
      new TabDef({
        key: "details",
        label: "Details",
        children: [
          new SectionDef({
            key: "main",
            columns: 2,
            children: [
              new FieldDef({ key: "form_key", label: "Form Key", keyField: true, required: true }),
              new FieldDef({ key: "form_name", label: "Form Name", required: true }),
              new FieldDef({ key: "menu_category", label: "Menu Category" }),
              new FieldDef({ key: "has_approvals", label: "Has Approvals", renderer: "boolean" }),
            ],
          }),
          new SectionDef({
            key: "description",
            label: "Description",
            columns: 1,
            children: [
              new FieldDef({ key: "description", label: "Description", renderer: "textarea" }),
            ],
          }),
          new SectionDef({
            key: "custom",
            label: "Custom Fields",
            columns: 1,
            children: [
              new FieldDef({ key: "custom_fields", label: "Custom Fields", renderer: "textarea" }),
            ],
          }),
        ],
      }),
      new TabDef({
        key: "settings",
        label: "Settings",
        children: [
          this.settingsGrid,
        ],
      }),
    ];
  }
}
