import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";
import { DomainLookup } from "@/components/lookup/presets/DomainLookup";

/**
 * SettingsEditPanel — Edit panel for System Settings.
 *
 * Tab: Setting
 *   Section: Identity
 *     setting_name (key)  owner  domain  form
 *   Section: Value
 *     value (textarea)
 *   Section: Help
 *     help_text (textarea)
 */
export class SettingsEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: false,
      useAudit: true,
      usePrint: false,
    }, form);

    this.tabs = [

      new TabDef({
        key:   "setting",
        label: "Setting",
        children: [
          new SectionDef({
            key:      "identity",
            label:    "Identity",
            columns:  2,
            children: [
              new FieldDef({ key: "setting_name", keyField: true, required: true }),
              new FieldDef({ key: "owner",        hidden: true, defaultValue: "SYSTEM" }),
              new FieldDef({ key: "domain", required: true, renderer: "lookup", lookupConfig: DomainLookup({ allOption: { value: "*", label: "All Domains" } }) }),
              new FieldDef({ key: "form",         hidden: true, defaultValue: "*" }),
            ],
          }),
          new SectionDef({
            key:      "value",
            label:    "Value",
            columns:  1,
            children: [
              new FieldDef({ key: "value", renderer: "textarea" }),
            ],
          }),
          new SectionDef({
            key:      "help",
            label:    "Help",
            columns:  1,
            children: [
              new FieldDef({ key: "help_text", renderer: "textarea" }),
            ],
          }),
        ],
      }),

    ];
  }
}
