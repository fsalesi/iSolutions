import { EditPanel } from "@/platform/core/EditPanel";
import { TabDef } from "@/platform/core/TabDef";
import { SectionDef } from "@/platform/core/SectionDef";
import { FieldDef } from "@/platform/core/FieldDef";
import { ActiveUserLookup } from "@/components/lookup/presets/UserLookup";
import { LocaleLookup }      from "@/components/lookup/presets/LocaleLookup";
import { DomainLookup }      from "@/components/lookup/presets/DomainLookup";

/**
 * UsersEditPanel — Edit panel for User maintenance.
 *
 * Tab: Details
 *   Section: Identity
 *     user_id (key)  full_name  email  title  company
 *     is_active  domains
 *
 * Tab: Contact
 *   Section: Phone
 *     phone  cell_phone
 *   Section: Address
 *     street1  street2  city  state  postal_code  country
 *
 * Tab: Settings
 *   Section: Account
 *     supervisor_id (lookup — ActiveUserLookup)
 *     delegate_id   (lookup — ActiveUserLookup)
 *     approval_limit  employee_number  expire_date  locale (lookup)  domains (lookup)
 *
 * Tab: Groups
 *   Section: Groups
 *     groups (readonly — managed via group_members, edit deferred)
 */
export class UsersEditPanel extends EditPanel {
  constructor(form?: any) {
    super({
      useNotes: true,
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
              new FieldDef({ key: "user_id",   label: "User ID",   keyField: true, required: true }),
              new FieldDef({ key: "full_name", label: "Full Name", required: true }),
              new FieldDef({ key: "email",     label: "Email",     required: true }),
              new FieldDef({ key: "title",     label: "Title" }),
              new FieldDef({ key: "company",   label: "Company" }),
              new FieldDef({ key: "is_active", label: "Active",   renderer: "checkbox" }),
              new FieldDef({ key: "domains",   label: "Domains", renderer: "lookup", lookupConfig: DomainLookup({ multiple: true }) }),
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
              new FieldDef({ key: "phone",      label: "Phone" }),
              new FieldDef({ key: "cell_phone", label: "Cell Phone" }),
            ],
          }),
          new SectionDef({
            key:      "address",
            label:    "Address",
            columns:  2,
            children: [
              new FieldDef({ key: "street1",     label: "Street 1" }),
              new FieldDef({ key: "street2",     label: "Street 2" }),
              new FieldDef({ key: "city",        label: "City" }),
              new FieldDef({ key: "state",       label: "State" }),
              new FieldDef({ key: "postal_code", label: "Postal Code" }),
              new FieldDef({ key: "country",     label: "Country" }),
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
              new FieldDef({ key: "supervisor_id",  label: "Supervisor",       renderer: "lookup", lookupConfig: ActiveUserLookup() }),
              new FieldDef({ key: "delegate_id",    label: "Delegate",         renderer: "lookup", lookupConfig: ActiveUserLookup() }),
              new FieldDef({ key: "approval_limit", label: "Approval Limit",   renderer: "number" }),
              new FieldDef({ key: "employee_number",label: "Employee Number" }),
              new FieldDef({ key: "expire_date",    label: "Expire Date",      renderer: "date" }),
              new FieldDef({ key: "locale",         label: "Locale",  renderer: "lookup", lookupConfig: LocaleLookup() }),
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
              new FieldDef({ key: "groups", label: "Groups", renderer: "readonly" }),
            ],
          }),
        ],
      }),

    ];
  }
}
