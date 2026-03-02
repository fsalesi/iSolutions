"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Section, TabBar, type TabDef } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { LocaleLookup, ActiveUserLookup, DomainLookup, GroupLookup, VendorLookup } from "@/components/lookup/presets";
import { Lookup } from "@/components/lookup/Lookup";
import { Icon } from "@/components/icons/Icon";

type User = { oid: string; [key: string]: any };

/* ── User Groups field (reads/writes group_members table) ── */
function UserGroupsField({ userId }: { userId: string }) {
  const t = useT();
  const [value, setValue] = useState("");
  const [memberMap, setMemberMap] = useState<Map<string, string>>(new Map()); // group_id → oid
  const loadedRef = useRef(false);

  // Load once on mount
  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;
    const filters = JSON.stringify({ type: "group", logic: "and", children: [{ type: "condition", field: "member_id", operator: "eq", value: userId }] });
    fetch(`/api/group_members?filters=${encodeURIComponent(filters)}&limit=1000`)
      .then(r => r.json())
      .then(data => {
        const rows = data.rows || [];
        const map = new Map<string, string>();
        rows.forEach((r: any) => map.set(r.group_id.toLowerCase(), r.oid));
        setMemberMap(map);
        setValue(rows.map((r: any) => r.group_id).join(","));
      })
      .catch(() => {});
  }, [userId]);

  const handleChange = useCallback((newVal: string) => {
    const prev = new Set(value.split(",").filter(Boolean).map(s => s.toLowerCase()));
    const next = new Set(newVal.split(",").filter(Boolean).map(s => s.toLowerCase()));
    const nextRaw = newVal.split(",").filter(Boolean);

    // Added
    for (const g of nextRaw) {
      if (!prev.has(g.toLowerCase())) {
        const tempOid = "temp-" + Date.now() + "-" + g;
        setMemberMap(m => new Map(m).set(g.toLowerCase(), tempOid));
        fetch("/api/group_members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: g, member_id: userId }),
        })
          .then(r => r.json())
          .then(saved => setMemberMap(m => { const n = new Map(m); if (n.get(g.toLowerCase())?.startsWith("temp-")) n.set(g.toLowerCase(), saved.oid); return n; }))
          .catch(() => {});
      }
    }

    // Removed
    for (const g of prev) {
      if (!next.has(g)) {
        const oid = memberMap.get(g);
        if (oid) {
          setMemberMap(m => { const n = new Map(m); n.delete(g); return n; });
          fetch(`/api/group_members?oid=${oid}`, { method: "DELETE" }).catch(() => {});
        }
      }
    }

    setValue(newVal);
  }, [value, memberMap, userId]);

  const config = useMemo(() => GroupLookup({ multiple: true, placeholder: t("users.search_groups", "Search groups...") }), [t]);

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        {t("users.groups", "Groups")}
      </label>
      <Lookup value={value} onChange={handleChange} config={config} />
    </div>
  );
}

function ProfileTab({ user, onChange, isNew, colTypes, colScales, requiredFields }: {
  user: User; onChange: (f: keyof User, v: any) => void; isNew: boolean;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
}) {
  const t = useT();
  const { field } = useFieldHelper({ row: user, onChange, table: "users", colTypes: colTypes as any, colScales, requiredFields });

  return (
    <div className="space-y-6">
      <Section title={t("users.section_status", "Status")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("is_active", { colorOn: "var(--success-text)", colorOff: "var(--danger-text)" })}
        </div>
      </Section>
      <Section title={t("users.section_identity", "Identity")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("user_id", { readOnly: !isNew })}
          {field("full_name")}
          {field("email", { type: "email" })}
          {field("company")}
          {field("title")}
          {field("domains", { type: "lookup", lookup: DomainLookup({ multiple: true }) })}
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
      {!isNew && (
        <Section title={t("users.section_groups", "Groups")}>
          <div>
            <UserGroupsField userId={user.user_id} />
          </div>
        </Section>
      )}
    </div>
  );
}

function IPurchaseTab({ user, onChange, colTypes, colScales, requiredFields }: {
  user: User; onChange: (f: keyof User, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
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

function UserTabs({ row, onChange, isNew, colTypes, colScales, requiredFields }: {
  row: User; isNew: boolean; onChange: (f: keyof User, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
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
        {activeTab === "profile" && <ProfileTab user={row} onChange={onChange} isNew={isNew} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} />}
        {activeTab === "ipurchase" && <IPurchaseTab user={row} onChange={onChange} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} />}
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
  ], [t]);

  const config = useMemo<CrudPageConfig<User>>(() => ({
    title: t("users.title", "Users"),
    apiPath: "/api/users",
    columns,
    renderTabs: (props) => <UserTabs {...props} />,
    extraActions,
  }), [t, columns, extraActions]);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
