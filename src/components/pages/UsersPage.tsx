"use client";

import { useState, useMemo } from "react";
import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { Section, TabBar, type TabDef } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { LocaleLookup, ActiveUserLookup, DomainLookup, ActiveGroupLookup, VendorLookup } from "@/components/lookup/presets";
import { Icon } from "@/components/icons/Icon";

type User = { oid: string; [key: string]: any };


function ProfileTab({ user, onChange, isNew, colTypes, colScales, requiredFields }: {
  user: Record<string, any>; onChange: (f: string, v: any) => void; isNew: boolean;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields: string[];
}) {
  const t = useT();
  const { field } = useFieldHelper({ row: user, onChange, table: "users", colTypes: colTypes as any, colScales, requiredFields });

  return (
    <div className="space-y-6">
      <Section title={t("users.section_status", "Status")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("is_active", { colorOn: "var(--success-text)" })}
        </div>
      </Section>
      <Section title={t("users.section_identity", "Identity")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("user_id", { readOnly: !isNew })}
          {field("full_name")}
          {field("email", { type: "email" })}
          {field("company")}
          {field("title")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4">
          {field("domains", { type: "lookup", lookup: DomainLookup({ multiple: true }) })}
          {!isNew && field("groups", { type: "lookup", lookup: ActiveGroupLookup({ multiple: true, placeholder: t("users.search_groups", "Search groups...") }) })}
        </div>
      </Section>
      <Section title={t("users.section_contact", "Contact")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("phone")}
          {field("cell_phone")}
          {field("street1")}
          {field("street2")}
          {field("city")}
          {field("state")}
          {field("postal_code")}
          {field("country")}
        </div>
      </Section>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {field("expire_date")}
        {field("locale", { type: "lookup", lookup: LocaleLookup({ dropdownColumns: [{ key: "flag_svg", type: "flag" }, "description"] }) })}
      </div>

    </div>
  );
}

function IPurchaseTab({ user, onChange, colTypes, colScales, requiredFields }: {
  user: Record<string, any>; onChange: (f: string, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields: string[];
}) {
  const t = useT();
  const { domain } = useSession();
  const { field } = useFieldHelper({ row: user, onChange, table: "users", colTypes: colTypes as any, colScales, requiredFields });
  return (
    <div className="space-y-6">
      <Section title={t("users.section_purchasing", "Purchasing")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("supervisor_id", { type: "lookup", lookup: ActiveUserLookup({ placeholder: t("users.search_supervisor", "Search supervisor...") }) })}
          {field("delegate_id", { type: "lookup", lookup: ActiveUserLookup({ placeholder: t("users.search_delegate", "Search delegate...") }) })}
          {field("approval_limit")}
          {field("employee_number", { type: "lookup", lookup: VendorLookup({ domain, placeholder: "Search vendors..." }) })}
        </div>
      </Section>
    </div>
  );
}

function UserTabs({ row, onChange, isNew, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState("profile");
  const tabs: TabDef[] = [
    { key: "profile",   label: t("users.tab_profile", "Profile"),     icon: <Icon name="user" size={15} /> },
    { key: "ipurchase", label: t("users.tab_ipurchase", "iPurchase"), icon: <Icon name="briefcase" size={15} /> },
  ];
  return (
    <>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "profile" && <ProfileTab user={row} onChange={onChange} isNew={isNew} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} />}
        {activeTab === "ipurchase" && <IPurchaseTab user={row} onChange={onChange} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} />}
      </div>
    </>
  );
}

const renderBody = (props: CrudPanelBodyProps) => <UserTabs {...props} />;

const COLUMNS: ColumnDef<User>[] = [
  { key: "user_id", locked: true },
];

export default function UsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();

  const extraActions: CrudAction[] = useMemo(() => [
    { key: "password", icon: "key",      label: t("users.tab_password", "Password"), separator: true },
    { key: "license",  icon: "shield",   label: t("users.tab_license", "License") },
    { key: "export",   icon: "download", label: t("grid.export", "Export") },
    { key: "import",   icon: "upload",   label: t("users.import", "Import") },
  ], [t]);

  return (
    <SplitCrudPage title={t("users.title", "Users")} table="users"
      columns={COLUMNS} renderBody={renderBody} extraActions={extraActions}
      activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />
  );
}
