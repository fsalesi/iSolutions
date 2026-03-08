import { EditPanel } from "@/platform/core/EditPanel";
import { FieldDef } from "@/platform/core/FieldDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { TabDef } from "@/platform/core/TabDef";

export class RequisitionLinesEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: true,
      useAudit: true,
    }, form);

    this.displayMode = "slide-in-right";
    this.title = "Line Details";

    this.tabs = [
      new TabDef({
        key:   "details",
        label: "Line Details",
        children: [
          new SectionDef({
            key:      "line",
            label:    "Line",
            columns:  2,
            children: [
              new FieldDef({ key: "line_number",  label: "Line #",      keyField: true, required: true, renderer: "number" }),
              new FieldDef({ key: "part_number",  label: "Part #" }),
              new FieldDef({ key: "description",  label: "Description" }),
              new FieldDef({ key: "quantity",     label: "Qty",         renderer: "number", required: true }),
              new FieldDef({ key: "unit_cost",    label: "Unit Cost",   renderer: "number" }),
              new FieldDef({ key: "line_total",   label: "Total",       renderer: "number", readOnly: true }),
            ],
          }),
          new SectionDef({
            key:      "accounting",
            label:    "Accounting",
            columns:  2,
            children: [
              new FieldDef({ key: "cost_center",  label: "Cost Center" }),
              new FieldDef({ key: "gl_account",   label: "GL Account" }),
            ],
          }),
        ],
      }),
    ];
  }
}
