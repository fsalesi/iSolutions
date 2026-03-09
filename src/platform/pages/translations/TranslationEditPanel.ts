import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";
import { LocaleLookup } from "@/components/lookup/presets/LocaleLookup";

export class TranslationEditPanel extends EditPanel {
  constructor(form?: any) {
    super({ useAudit: true }, form);

    this.tabs = [
      new TabDef({ key: "details", label: "Details", children: [

        new SectionDef({ key: "identity", columns: 3, children: [
          new FieldDef({ key: "locale",    keyField: true, required: true,
            renderer: "lookup", lookupConfig: LocaleLookup() }),
          new FieldDef({ key: "namespace", keyField: true, required: true,
            renderer: "select",
            options: [
              { value: "audit",         label: "audit" },
              { value: "crud",          label: "crud" },
              { value: "filter",        label: "filter" },
              { value: "global",        label: "global" },
              { value: "grid",          label: "grid" },
              { value: "group_members", label: "group_members" },
              { value: "groups",        label: "groups" },
              { value: "locales",       label: "locales" },
              { value: "message",       label: "message" },
              { value: "nav",           label: "nav" },
              { value: "notes",         label: "notes" },
              { value: "pasoe_brokers", label: "pasoe_brokers" },
              { value: "settings",      label: "settings" },
              { value: "shell",         label: "shell" },
              { value: "translations",  label: "translations" },
              { value: "users",         label: "users" },
              { value: "validation",    label: "validation" },
            ],
          }),
          new FieldDef({ key: "key", keyField: true, required: true }),
        ]}),

        new SectionDef({ key: "translation", label: "Translation", columns: 1, children: [
          new FieldDef({ key: "value", renderer: "textarea", required: true }),
        ]}),

      ]}),
    ];
  }
}
