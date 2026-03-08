import { ActiveGroupLookup } from "@/components/lookup/presets/GroupLookup";
import { LocaleLookup }      from "@/components/lookup/presets/LocaleLookup";
import { ActiveUserLookup } from "@/components/lookup/presets/UserLookup";
import { DomainLookup }      from "@/components/lookup/presets/DomainLookup";
import { VendorLookup }      from "@/components/lookup/presets/VendorLookup";
import { EditPanel } from "@/platform/core/EditPanel";
import { FieldDef } from "@/platform/core/FieldDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { TabDef } from "@/platform/core/TabDef";
import { UsersKeyPanel } from "./UsersKeyPanel";

export class UsersEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: true,
      useAudit: true,
      usePrint: false,
    }, form);

    this.headerRenderer = ({ currentRecord, isNew }) =>
      UsersKeyPanel({ currentRecord, isNew });

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
              new FieldDef({ key: "user_id",   keyField: true, required: true }),
              new FieldDef({ key: "full_name", required: true }),
              new FieldDef({ key: "email",     required: true }),
              new FieldDef({ key: "title" }),
              new FieldDef({ key: "company" }),
              new FieldDef({ key: "is_active", renderer: "checkbox" }),
              new FieldDef({ key: "domains",   renderer: "lookup", lookupConfig: DomainLookup({ multiple: true }) }),
            ],
          }),
        ],
      }),
      new TabDef({
        key:   "contact",
        label: "Contact",
        children: [
          new SectionDef({
            key:      "phone",
            label:    "Phone",
            columns:  2,
            children: [
              new FieldDef({ key: "phone" }),
              new FieldDef({ key: "cell_phone" }),
            ],
          }),
          new SectionDef({
            key:      "address",
            label:    "Address",
            columns:  2,
            children: [
              new FieldDef({ key: "street1" }),
              new FieldDef({ key: "street2" }),
              new FieldDef({ key: "city" }),
              new FieldDef({ key: "state" }),
              new FieldDef({ key: "postal_code" }),
              new FieldDef({ key: "country" }),
            ],
          }),
        ],
      }),
      new TabDef({
        key:   "settings",
        label: "Settings",
        children: [
          new SectionDef({
            key:      "account",
            label:    "Account",
            columns:  2,
            children: [
              new FieldDef({ key: "supervisor_id",  renderer: "lookup", lookupConfig: ActiveUserLookup() }),
              new FieldDef({ key: "delegate_id",    renderer: "lookup", lookupConfig: ActiveUserLookup() }),
              new FieldDef({ key: "approval_limit", renderer: "number" }),
              new FieldDef({ key: "employee_number", renderer: "lookup", lookupConfig: VendorLookup({ domain: "" }) }),
              new FieldDef({ key: "expire_date",    renderer: "date" }),
              new FieldDef({ key: "locale",         renderer: "lookup", lookupConfig: LocaleLookup() }),
            ],
          }),
        ],
      }),
      new TabDef({
        key:   "groups",
        label: "Groups",
        children: [
          new SectionDef({
            key:      "memberships",
            label:    "Group Memberships",
            columns:  1,
            children: [
              new FieldDef({ key: "groups", renderer: "lookup", lookupConfig: ActiveGroupLookup({ multiple: true }) }),
            ],
          }),
        ],
      }),
    ];
  }
}
