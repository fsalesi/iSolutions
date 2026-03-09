import { ActiveUserLookup } from "@/components/lookup/presets/UserLookup";
import { VendorLookup }     from "@/components/lookup/presets/VendorLookup";
import { EditPanel } from "@/platform/core/EditPanel";
import { FieldDef } from "@/platform/core/FieldDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { TabDef } from "@/platform/core/TabDef";
import { RequisitionKeyPanel } from "@customer/pages/requisition/RequisitionKeyPanel";
import { RequisitionLinesGrid } from "@customer/pages/requisition/RequisitionLinesGrid";

export class RequisitionEditPanel extends EditPanel {
  linesGrid = new RequisitionLinesGrid();

  constructor(form?: any) {
    super({
      useNotes: true,
      useAudit: true,
      usePrint: false,
    }, form);

    this.headerRenderer = () =>
      RequisitionKeyPanel({ currentRecord: this.currentRecord, isNew: this.isNew });

    this.tabs = [
      new TabDef({
        key:   "details",
        label: "Details",
        children: [
          new SectionDef({
            key:      "header",
            label:    "Requisition",
            columns:  2,
            children: [
              new FieldDef({ key: "req_number",   label: "Req #",       keyField: true, required: true }),
              new FieldDef({ key: "req_type",     label: "Type",        required: true }),
              new FieldDef({ key: "description",  label: "Description" }),
              new FieldDef({ key: "vendor_code",  label: "Vendor",      renderer: "lookup", lookupConfig: VendorLookup({ domain: "" }) }),
              new FieldDef({ key: "buyer",        label: "Buyer",       renderer: "lookup", lookupConfig: ActiveUserLookup() }),
              new FieldDef({ key: "need_date",    label: "Need Date",   renderer: "date" }),
              new FieldDef({ key: "is_urgent",    label: "Urgent",      renderer: "boolean" }),
            ],
          }),
          new SectionDef({
            key:      "amounts",
            label:    "Amounts",
            columns:  2,
            children: [
              new FieldDef({ key: "total_amount", label: "Total Amount", renderer: "number", readOnly: true }),
            ],
          }),
        ],
      }),

      new TabDef({
        key:   "lines",
        label: "Lines",
        children: [
          this.linesGrid,
        ],
      }),

      new TabDef({
        key:   "workflow",
        label: "Workflow",
        children: [
          new SectionDef({
            key:      "status",
            label:    "Status",
            columns:  2,
            children: [
              new FieldDef({ key: "status",        label: "Status",       readOnly: true }),
              new FieldDef({ key: "is_change_order", label: "Change Order", renderer: "boolean", readOnly: true }),
              new FieldDef({ key: "created_by",    label: "Created By",   readOnly: true }),
              new FieldDef({ key: "created_at",    label: "Created",      renderer: "datetime", readOnly: true }),
              new FieldDef({ key: "submitted_by",  label: "Submitted By", readOnly: true }),
              new FieldDef({ key: "submitted_at",  label: "Submitted",    renderer: "datetime", readOnly: true }),
              new FieldDef({ key: "approved_by",   label: "Approved By",  readOnly: true }),
              new FieldDef({ key: "approved_at",   label: "Approved",     renderer: "datetime", readOnly: true }),
            ],
          }),
        ],
      }),

      new TabDef({
        key:   "justification",
        label: "Justification",
        children: [
          new SectionDef({
            key:      "notes",
            label:    "Justification",
            columns:  1,
            children: [
              new FieldDef({ key: "justification_note", label: "Justification Note", renderer: "textarea" }),
            ],
          }),
        ],
      }),
    ];
  }
}
