"use client";
import { fmtMoney } from "@/lib/format";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Section, Field, Input, Select, Checkbox, Badge, TabBar, type TabDef } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { LocaleSelect } from "@/components/ui/LocaleSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/icons/Icon";

type User = { oid: string; [key: string]: any };

function UserCard({ row, isSelected }: { row: User; isSelected: boolean }) {
  const t = useT();
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
      {row.is_disabled
        ? <Badge variant="danger">{t("users.status_disabled", "Disabled")}</Badge>
        : <Badge variant="success">{t("users.status_active", "Active")}</Badge>}
      <Icon name="chevRight" size={16} className="flex-shrink-0" style={{ color: "var(--text-muted)" } as any} />
    </div>
  );
}

function ProfileTab({ user, onChange }: { user: User; onChange: (f: keyof User, v: any) => void }) {
  const t = useT();
  const [localeOpts, setLocaleOpts] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    fetch("/api/locales?limit=100")
      .then(r => r.json())
      .then(d => setLocaleOpts(d.rows.map((l: any) => ({ value: l.code, label: `${l.code} \u2014 ${l.description}` }))))
      .catch(() => {});
  }, []);
  return (
    <div className="space-y-6 max-w-4xl">
      <Section title={t("users.section_identity", "Identity")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label={t("users.user_id", "User ID")} required><Input value={user.user_id} readOnly /></Field>
          <Field label={t("users.full_name", "Full Name")} required><Input value={user.full_name} onChange={v => onChange("full_name", v)} /></Field>
          <Field label={t("users.email", "Email")} required><Input value={user.email} onChange={v => onChange("email", v)} type="email" /></Field>
          <Field label={t("users.company", "Company")}><Input value={user.company} onChange={v => onChange("company", v)} /></Field>
          <Field label={t("users.title_field", "Title")}><Input value={user.title} onChange={v => onChange("title", v)} /></Field>
          <Field label={t("users.domains", "Domains")} required><Input value={user.domains} onChange={v => onChange("domains", v)} /></Field>
          <Field label={t("users.locale", "Language")}><LocaleSelect value={user.locale} onChange={v => onChange("locale", v)} options={localeOpts} /></Field>
        </div>
      </Section>
      <Section title={t("users.section_status", "Status")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label={t("users.is_disabled", "Disabled")}>
            <Checkbox checked={user.is_disabled} onChange={v => onChange("is_disabled", v)} label={user.is_disabled ? t("users.status_disabled", "Disabled") : t("users.status_active", "Active")} />
          </Field>
          <Field label={t("users.expiration_date", "Expiration Date")}><DatePicker value={user.expire_date ?? null} onChange={v => onChange("expire_date", v)} /></Field>
          <Field label={t("users.last_login", "Last Login")}><DatePicker value={user.last_login ?? null} onChange={() => {}} readOnly /></Field>
          <Field label={t("users.failed_logins", "Failed Logins")}><Input value={String(user.failed_logins)} readOnly /></Field>
        </div>
      </Section>
      <Section title={t("users.section_contact", "Contact")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label={t("users.phone", "Phone")}><Input value={user.phone} onChange={v => onChange("phone", v)} /></Field>
          <Field label={t("users.cell_phone", "Cell Phone")}><Input value={user.cell_phone} onChange={v => onChange("cell_phone", v)} /></Field>
          <Field label={t("users.street1", "Street 1")}><Input value={user.street1} onChange={v => onChange("street1", v)} /></Field>
          <Field label={t("users.street2", "Street 2")}><Input value={user.street2} onChange={v => onChange("street2", v)} /></Field>
          <Field label={t("users.city", "City")}><Input value={user.city} onChange={v => onChange("city", v)} /></Field>
          <Field label={t("users.state", "State")}><Input value={user.state} onChange={v => onChange("state", v)} /></Field>
          <Field label={t("users.postal_code", "Postal Code")}><Input value={user.postal_code} onChange={v => onChange("postal_code", v)} /></Field>
          <Field label={t("users.country", "Country")}><Input value={user.country} onChange={v => onChange("country", v)} /></Field>
        </div>
      </Section>
    </div>
  );
}

function IPurchaseTab({ user, onChange }: { user: User; onChange: (f: keyof User, v: any) => void }) {
  const t = useT();

  return (
    <div className="max-w-4xl space-y-6">
      <Section title={t("users.section_purchasing", "Purchasing")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label={t("users.supervisor", "Supervisor")}><Input value={user.supervisor_id} onChange={v => onChange("supervisor_id", v)} /></Field>
          <Field label={t("users.delegate", "Delegate")}><Input value={user.delegate_id} onChange={v => onChange("delegate_id", v)} /></Field>
          <Field label={t("users.approval_limit", "Approval Limit ($)")}>
            <Input value={fmtMoney(user.approval_limit)} onChange={v => onChange("approval_limit", v.replace(/,/g, ""))} />
          </Field>
          <Field label={t("users.employee_number", "Employee Number")}><Input value={user.employee_number} onChange={v => onChange("employee_number", v)} /></Field>
          <Field label={t("users.erp_initials", "ERP Initials")}><Input value={user.erp_initials} onChange={v => onChange("erp_initials", v)} /></Field>
        </div>
      </Section>
    </div>
  );
}

function UserTabs({ row, onChange }: { row: User; isNew: boolean; onChange: (f: keyof User, v: any) => void }) {
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
        {activeTab === "profile" && <ProfileTab user={row} onChange={onChange} />}
        {activeTab === "ipurchase" && <IPurchaseTab user={row} onChange={onChange} />}
      </div>
    </>
  );
}

export default function UsersPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();

  const columns: ColumnDef<User>[] = useMemo(() => [
    { key: "user_id", label: t("users.user_id", "User ID"), locked: true },
    { key: "full_name", label: t("users.full_name", "Name") },
    { key: "email", label: t("users.email", "Email") },
    {
      key: "is_disabled" as any, label: t("users.section_status", "Status"),
      render: (row) => row.is_disabled
        ? <Badge variant="danger">{t("users.status_disabled", "Disabled")}</Badge>
        : <Badge variant="success">{t("users.status_active", "Active")}</Badge>,
    },
    { key: "domains", label: t("users.domains", "Domains") },
    { key: "supervisor_id", label: t("users.supervisor", "Supervisor") },
    { key: "approval_limit", label: t("users.approval_limit", "Approval Limit") },
    { key: "title", label: t("users.title_field", "Title") },
    { key: "company", label: t("users.company", "Company") },
    { key: "city", label: t("users.city", "City") },
    { key: "state", label: t("users.state", "State") },
    { key: "phone", label: t("users.phone", "Phone") },
    { key: "last_login" as any, label: t("users.last_login", "Last Login") },
    { key: "postal_code", label: t("users.postal_code", "Postal Code") },
  ], [t]);

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
