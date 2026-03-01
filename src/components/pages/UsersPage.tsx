"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Section, TabBar, type TabDef } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { LocaleLookup, ActiveUserLookup } from "@/components/lookup/presets";
import { Icon } from "@/components/icons/Icon";

type User = { oid: string; [key: string]: any };

function UserCard({ row, isSelected }: { row: User; isSelected: boolean }) {
  return (
    <div className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
      style={{ background: isSelected ? "var(--bg-selected)" : "transparent", borderBottom: "1px solid var(--border-light)" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: "var(--bg-surface-alt)", color: "var(--text-secondary)" }}>
        {row.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{row.full_name}</div>
        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{row.user_id} · {row.email}</div>
      </div>
      <Icon name="chevRight" size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" } as any} />
    </div>
  );
}

function ProfileTab({ user, onChange, isNew, colTypes, colScales }: {
  user: User; onChange: (f: keyof User, v: any) => void; isNew: boolean;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
  const t = useT();
  const field = useFieldHelper({ row: user, onChange, table: "users", colTypes: colTypes as any, colScales });

  return (
    <div className="space-y-6 max-w-4xl">
      <Section title={t("users.section_identity", "Identity")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("user_id", { required: true, readOnly: !isNew })}
          {field("full_name", { required: true })}
          {field("email", { type: "email", required: true })}
          {field("company")}
          {field("title")}
          {field("domains", { required: true })}
          {field("locale", { type: "lookup", lookup: LocaleLookup({ dropdownColumns: [{ key: "flag_svg", type: "flag" }, "description"] }) })}
        </div>
      </Section>
      <Section title={t("users.section_status", "Status")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("is_active", { colorOn: "var(--success-text)", colorOff: "var(--danger-text)" })}
          {field("expire_date")}
          {field("last_login", { readOnly: true, mode: "datetime" })}
          {field("failed_logins", { readOnly: true })}
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
    </div>
  );
}

function IPurchaseTab({ user, onChange, colTypes, colScales }: {
  user: User; onChange: (f: keyof User, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
  const t = useT();
  const field = useFieldHelper({ row: user, onChange, table: "users", colTypes: colTypes as any, colScales });
  return (
    <div className="max-w-4xl space-y-6">
      <Section title={t("users.section_purchasing", "Purchasing")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("supervisor_id", { type: "lookup", lookup: ActiveUserLookup({ placeholder: "Search supervisor..." }) })}
          {field("delegate_id", { type: "lookup", lookup: ActiveUserLookup({ placeholder: "Search delegate..." }) })}
          {field("approval_limit")}
          {field("employee_number")}
          {field("erp_initials")}
        </div>
      </Section>
    </div>
  );
}

function UserTabs({ row, onChange, isNew, colTypes, colScales }: {
  row: User; isNew: boolean; onChange: (f: keyof User, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
}) {
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
        {activeTab === "profile" && <ProfileTab user={row} onChange={onChange} isNew={isNew} colTypes={colTypes} colScales={colScales} />}
        {activeTab === "ipurchase" && <IPurchaseTab user={row} onChange={onChange} colTypes={colTypes} colScales={colScales} />}
      </div>
    </>
  );
}

export default function UsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();

  const columns: ColumnDef<User>[] = useMemo(() => [
    { key: "user_id", locked: true },
  ], []);

  const extraActions: CrudAction[] = useMemo(() => [
    { key: "password", icon: "key",      label: t("users.tab_password", "Password"), separator: true },
    { key: "license",  icon: "shield",   label: t("users.tab_license", "License") },
    { key: "export",   icon: "download", label: t("grid.export", "Export") },
    { key: "import",   icon: "upload",   label: t("users.import", "Import") },
    { key: "unlock",   icon: "unlock",   label: t("users.unlock", "Unlock") },
  ], [t]);

  const renderCard = useCallback((row: User, isSelected: boolean) => (
    <UserCard row={row} isSelected={isSelected} />
  ), []);

  const config = useMemo<CrudPageConfig<User>>(() => ({
    title: t("users.title", "Users and Groups"),
    apiPath: "/api/users",
    columns,
    renderTabs: (props) => <UserTabs {...props} />,
    renderCard,
    extraActions,
  }), [t, columns, renderCard, extraActions]);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
