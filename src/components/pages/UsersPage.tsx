"use client";
import { fmtDate, fmtMoney } from "@/lib/format";

import { useState, useMemo, useCallback } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Section, Field, Input, Checkbox, Badge, TabBar, type TabDef } from "@/components/ui";
import { Icon } from "@/components/icons/Icon";

type User = { oid: string; [key: string]: any };



const USER_COLUMNS: ColumnDef<User>[] = [
  { key: "user_id", label: "User ID", locked: true },
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
  {
    key: "is_disabled" as any, label: "Status",
    render: (row) => row.is_disabled
      ? <Badge variant="danger">Disabled</Badge>
      : <Badge variant="success">Active</Badge>,
  },
  { key: "domains", label: "Domains" },
  { key: "supervisor_id", label: "Supervisor" },
  { key: "approval_limit", label: "Approval Limit" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "phone", label: "Phone" },
  { key: "last_login" as any, label: "Last Login" },
  { key: "postal_code", label: "Postal Code" },
];

const USER_TABS: TabDef[] = [
  { key: "profile",   label: "Profile",   icon: <Icon name="user" size={15} /> },
  { key: "ipurchase", label: "iPurchase", icon: <Icon name="briefcase" size={15} /> },
];

const USER_EXTRA_ACTIONS: CrudAction[] = [
  { key: "password", icon: "key",      label: "Password", separator: true },
  { key: "license",  icon: "shield",   label: "License" },
  { key: "export",   icon: "download", label: "Export" },
  { key: "import",   icon: "upload",   label: "Import" },
  { key: "unlock",   icon: "unlock",   label: "Unlock" },
];

function UserCard({ row, isSelected }: { row: User; isSelected: boolean }) {
  return (
    <div className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer"
      style={{ background: isSelected ? "var(--bg-selected)" : "transparent", borderBottom: "1px solid var(--border-light)" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: "var(--bg-surface-alt)", color: "var(--text-secondary)" }}>
        {row.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{row.full_name}</div>
        <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{row.user_id} · {row.email}</div>
      </div>
      {row.is_disabled
        ? <Badge variant="danger">Disabled</Badge>
        : <Badge variant="success">Active</Badge>}
      <Icon name="chevRight" size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" } as any} />
    </div>
  );
}

function ProfileTab({ user, onChange }: { user: User; onChange: (f: keyof User, v: any) => void }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <Section title="Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="User ID" required><Input value={user.user_id} readOnly /></Field>
          <Field label="Full Name" required><Input value={user.full_name} onChange={v => onChange("full_name", v)} /></Field>
          <Field label="Email" required><Input value={user.email} onChange={v => onChange("email", v)} type="email" /></Field>
          <Field label="Company"><Input value={user.company} onChange={v => onChange("company", v)} /></Field>
          <Field label="Title"><Input value={user.title} onChange={v => onChange("title", v)} /></Field>
          <Field label="Domains" required><Input value={user.domains} onChange={v => onChange("domains", v)} /></Field>
        </div>
      </Section>
      <Section title="Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Disabled">
            <Checkbox checked={user.is_disabled} onChange={v => onChange("is_disabled", v)} label={user.is_disabled ? "Account disabled" : "Account active"} />
          </Field>
          <Field label="Expiration Date"><Input value={fmtDate(user.expire_date)} readOnly /></Field>
          <Field label="Last Login"><Input value={fmtDate(user.last_login)} readOnly /></Field>
          <Field label="Failed Logins"><Input value={String(user.failed_logins)} readOnly /></Field>

        </div>
      </Section>
      <Section title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Phone"><Input value={user.phone} onChange={v => onChange("phone", v)} /></Field>
          <Field label="Fax"><Input value={user.fax} onChange={v => onChange("fax", v)} /></Field>
          <Field label="Street 1"><Input value={user.street1} onChange={v => onChange("street1", v)} /></Field>
          <Field label="Street 2"><Input value={user.street2} onChange={v => onChange("street2", v)} /></Field>
          <Field label="City"><Input value={user.city} onChange={v => onChange("city", v)} /></Field>
          <Field label="State"><Input value={user.state} onChange={v => onChange("state", v)} /></Field>
          <Field label="Postal Code"><Input value={user.postal_code} onChange={v => onChange("postal_code", v)} /></Field>
          <Field label="Country"><Input value={user.country} onChange={v => onChange("country", v)} /></Field>
        </div>
      </Section>
    </div>
  );
}

function IPurchaseTab({ user, onChange }: { user: User; onChange: (f: keyof User, v: any) => void }) {
  return (
    <div className="max-w-4xl space-y-6">
      <Section title="Purchasing">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Supervisor"><Input value={user.supervisor_id} onChange={v => onChange("supervisor_id", v)} /></Field>
          <Field label="Delegate"><Input value={user.delegate_id} onChange={v => onChange("delegate_id", v)} /></Field>
          <Field label="Approval Limit ($)">
            <Input value={fmtMoney(user.approval_limit)} onChange={v => onChange("approval_limit", v.replace(/,/g, ""))} />
          </Field>
          <Field label="Employee Number"><Input value={user.employee_number} onChange={v => onChange("employee_number", v)} /></Field>
          <Field label="ERP Initials"><Input value={user.erp_initials} onChange={v => onChange("erp_initials", v)} /></Field>
        </div>
      </Section>
    </div>
  );
}

function UserTabs({ row, onChange }: { row: User; isNew: boolean; onChange: (f: keyof User, v: any) => void }) {
  const [activeTab, setActiveTab] = useState("profile");
  return (
    <>
      <TabBar tabs={USER_TABS} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "profile" && <ProfileTab user={row} onChange={onChange} />}
        {activeTab === "ipurchase" && <IPurchaseTab user={row} onChange={onChange} />}
      </div>
    </>
  );
}

export default function UsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const renderCard = useCallback((row: User, isSelected: boolean) => (
    <UserCard row={row} isSelected={isSelected} />
  ), []);

  const config = useMemo<CrudPageConfig<User>>(() => ({
    title: "Users and Groups",
    apiPath: "/api/users",
    columns: USER_COLUMNS,
    renderTabs: (props) => <UserTabs {...props} />,
    renderCard,
    extraActions: USER_EXTRA_ACTIONS,
  }), [renderCard]);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
