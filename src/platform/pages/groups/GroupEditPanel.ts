import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";
import { ActiveUserLookup } from "@/components/lookup/presets/UserLookup";

export class GroupEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: false,
      useAudit: true,
      usePrint: false,
    }, form);

    this.tabs = [

      new TabDef({
        key:   "details",
        label: "Details",
        children: [
          new SectionDef({
            key:      "identity",
            label:    "Identity",
            columns:  2,
            children: [
              new FieldDef({ key: "group_id",    keyField: true, required: true }),
              new FieldDef({ key: "description", required: true }),
              new FieldDef({ key: "is_active",   renderer: "boolean" }),
            ],
          }),
        ],
      }),

      new TabDef({
        key:   "members",
        label: "Members",
        children: [
          new SectionDef({
            key:      "members",
            label:    "Members",
            columns:  1,
            children: [
              new FieldDef({
                key:          "members",
                label:        "Members",
                renderer:     "lookup",
                lookupConfig: ActiveUserLookup({
                  multiple:      true,
                  checklist:     true,
                  valueField:    "user_id",
                  displayField:  "full_name",
                }),
              }),
            ],
          }),
        ],
      }),

    ];
  }
}
