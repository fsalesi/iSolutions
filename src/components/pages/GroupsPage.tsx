"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { SplitCrudPage } from "./SplitCrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { Section, TabBar, type TabDef, Input } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";
import { Icon } from "@/components/icons/Icon";

type Row = { oid: string; [key: string]: any };
type MemberRecord = { oid: string; group_id: string; member_id: string; is_excluded: boolean };
type ChecklistItem = { id: string; label: string; sub?: string };

/* ── General Tab ─────────────────────────────────────────── */
function GeneralTab({ row, isNew, onChange, colTypes, colScales, requiredFields }: {
  row: Record<string, any>; isNew: boolean; onChange: (f: string, v: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>;
  requiredFields: string[];
}) {
  const t = useT();
  const { field } = useFieldHelper({ row, onChange, table: "groups", colTypes: colTypes as any, colScales, requiredFields });
  return (
    <div className="space-y-6">
      <Section title={t("groups.section_general", "General")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {field("group_id", { readOnly: !isNew })}
          {field("description")}
          {field("is_active", { colorOn: "var(--success-text)", colorOff: "var(--danger-text)" })}
        </div>
      </Section>
    </div>
  );
}

/* ── Members Tab ─────────────────────────────────────────── */
function MembersTab({ row }: { row: Record<string, any> }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [showSelected, setShowSelected] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [allUsers, setAllUsers] = useState<ChecklistItem[]>([]);

  const groupId = row.group_id;
  const isNew = !row.oid;

  // Fetch current members
  useEffect(() => {
    if (!groupId) return;
    const filters = JSON.stringify({ type: "group", logic: "and", children: [{ type: "condition", field: "group_id", operator: "eq", value: groupId }] });
    fetch(`/api/group_members?filters=${encodeURIComponent(filters)}&limit=1000`)
      .then(r => r.json())
      .then(data => setMembers(data.rows || []))
      .catch(() => setMembers([]));
  }, [groupId]);

  // Fetch all users (once)
  useEffect(() => {
    fetch("/api/users?limit=1000&sort=user_id")
      .then(r => r.json())
      .then(data => {
        setAllUsers((data.rows || []).map((u: any) => ({
          id: u.user_id,
          label: u.full_name || u.user_id,
          sub: u.email,
        })));
      })
      .catch(() => setAllUsers([]));
  }, []);

  // Map of member_id → MemberRecord
  const memberMap = useMemo(() => {
    const m = new Map<string, MemberRecord>();
    for (const rec of members) m.set(rec.member_id.toLowerCase(), rec);
    return m;
  }, [members]);

  const selectedCount = memberMap.size;

  // Snapshot initial members for stable sort order
  useEffect(() => { initialMembersRef.current = null; }, [groupId]);
  const initialMembersRef = useRef<Set<string> | null>(null);
  if (initialMembersRef.current === null && memberMap.size > 0) {
    initialMembersRef.current = new Set(memberMap.keys());
  }

  // Filter + sort: initially selected at top, order locked after first load
  const filtered = useMemo(() => {
    let list = allUsers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.id.toLowerCase().includes(q) || i.label.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q));
    }
    if (showSelected) {
      list = list.filter(i => memberMap.has(i.id.toLowerCase()));
    }
    const snap = initialMembersRef.current;
    return [...list].sort((a, b) => {
      const aIn = snap?.has(a.id.toLowerCase()) ? 0 : 1;
      const bIn = snap?.has(b.id.toLowerCase()) ? 0 : 1;
      return aIn - bIn || a.id.localeCompare(b.id);
    });
  }, [allUsers, search, showSelected, memberMap]);

  const toggleMember = useCallback(async (id: string) => {
    const key = id.toLowerCase();
    if (busy.has(key)) return;
    setBusy(prev => new Set(prev).add(key));

    const existing = memberMap.get(key);
    if (existing) {
      setMembers(prev => prev.filter(m => m.oid !== existing.oid));
      try {
        await fetch(`/api/group_members?oid=${existing.oid}`, { method: "DELETE" });
      } catch {
        setMembers(prev => [...prev, existing]);
      }
    } else {
      const tempOid = "temp-" + Date.now();
      const optimistic: MemberRecord = { oid: tempOid, group_id: groupId, member_id: id, is_excluded: false };
      setMembers(prev => [...prev, optimistic]);
      try {
        const res = await fetch("/api/group_members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId, member_id: id }),
        });
        const saved = await res.json();
        setMembers(prev => prev.map(m => m.oid === tempOid ? { ...optimistic, oid: saved.oid } : m));
      } catch {
        setMembers(prev => prev.filter(m => m.oid !== tempOid));
      }
    }
    setBusy(prev => { const s = new Set(prev); s.delete(key); return s; });
  }, [memberMap, groupId, busy]);

  const toggleExclude = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = id.toLowerCase();
    const rec = memberMap.get(key);
    if (!rec || busy.has(key)) return;
    setBusy(prev => new Set(prev).add(key));

    const newVal = !rec.is_excluded;
    setMembers(prev => prev.map(m => m.oid === rec.oid ? { ...m, is_excluded: newVal } : m));
    try {
      await fetch("/api/group_members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oid: rec.oid, is_excluded: newVal }),
      });
    } catch {
      setMembers(prev => prev.map(m => m.oid === rec.oid ? { ...m, is_excluded: !newVal } : m));
    }
    setBusy(prev => { const s = new Set(prev); s.delete(key); return s; });
  }, [memberMap, busy]);

  const selectAll = useCallback(async () => {
    const toAdd = filtered.filter(i => !memberMap.has(i.id.toLowerCase()));
    if (!toAdd.length) return;
    const tempMembers = toAdd.map(i => ({
      oid: "temp-" + Date.now() + "-" + i.id,
      group_id: groupId, member_id: i.id, is_excluded: false,
    } as MemberRecord));
    setMembers(prev => [...prev, ...tempMembers]);
    for (const item of toAdd) {
      try {
        const res = await fetch("/api/group_members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId, member_id: item.id }),
        });
        const saved = await res.json();
        setMembers(prev => prev.map(m =>
          m.member_id.toLowerCase() === item.id.toLowerCase() && m.oid.startsWith("temp-")
            ? { ...m, oid: saved.oid } : m
        ));
      } catch { /* optimistic stays */ }
    }
  }, [filtered, memberMap, groupId]);

  const deselectAll = useCallback(async () => {
    const toRemove = filtered.filter(i => memberMap.has(i.id.toLowerCase()));
    if (!toRemove.length) return;
    const oids = toRemove.map(i => memberMap.get(i.id.toLowerCase())!.oid);
    setMembers(prev => prev.filter(m => !oids.includes(m.oid)));
    for (const oid of oids) {
      try { await fetch(`/api/group_members?oid=${oid}`, { method: "DELETE" }); }
      catch { /* already removed optimistically */ }
    }
  }, [filtered, memberMap]);

  if (isNew) {
    return (
      <p className="text-sm p-2" style={{ color: "var(--text-muted)" }}>
        {t("groups.save_first", "Save the group before adding members.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + selected filter */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input value={search} onChange={setSearch} placeholder={t("groups.search_filter", "Filter...")} />
        </div>
        <button onClick={() => setShowSelected(v => !v)}
          className="text-xs px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors"
          style={{
            background: showSelected ? "var(--accent)" : "var(--bg-surface-alt)",
            color: showSelected ? "var(--accent-text)" : "var(--text-secondary)",
            border: `1px solid ${showSelected ? "var(--accent)" : "var(--border)"}`,
          }}>
          {selectedCount} {t("groups.selected", "selected")}
        </button>
        <button onClick={selectAll} title={t("groups.select_all", "Select all")}
          className="p-1.5 rounded transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Icon name="check" size={14} />
        </button>
        <button onClick={deselectAll} title={t("groups.deselect_all", "Deselect all")}
          className="p-1.5 rounded transition-colors"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* User list */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              {search ? t("groups.no_results", "No results") : t("groups.no_items", "No items")}
            </div>
          ) : filtered.map(item => {
            const key = item.id.toLowerCase();
            const rec = memberMap.get(key);
            const checked = !!rec;
            const excluded = rec?.is_excluded ?? false;
            const isBusy = busy.has(key);

            return (
              <div key={item.id} onClick={() => toggleMember(item.id)}
                className="flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors"
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  opacity: isBusy ? 0.5 : 1,
                  background: excluded ? "var(--danger-bg, #fef2f2)" : "transparent",
                }}
                onMouseEnter={e => { if (!excluded) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={e => { if (!excluded) e.currentTarget.style.background = "transparent"; }}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    border: `2px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                    background: checked ? "var(--accent)" : "transparent",
                  }}>
                  {checked && <Icon name="check" size={12} style={{ color: "#fff" } as any} />}
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{
                    color: excluded ? "var(--danger-text)" : "var(--text-primary)",
                    textDecoration: excluded ? "line-through" : "none",
                  }}>{item.id}</span>
                  {item.label !== item.id && (
                    <span className="ml-2 text-sm" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                  )}
                  {item.sub && (
                    <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>{item.sub}</span>
                  )}
                </div>

                {checked && (
                  <button onClick={(e) => toggleExclude(item.id, e)}
                    title={excluded ? t("groups.include", "Include") : t("groups.exclude", "Exclude")}
                    className="p-1 rounded transition-colors flex-shrink-0"
                    style={{ color: excluded ? "var(--danger-text)" : "var(--text-muted)" }}>
                    <Icon name={excluded ? "x" : "ban"} size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Tabbed Detail ─────────────────────────────────────────── */
function GroupTabs({ row, isNew, onChange, colTypes, colScales, requiredFields }: CrudPanelBodyProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState("general");
  const tabs: TabDef[] = [
    { key: "general", label: t("groups.tab_general", "General"), icon: <Icon name="settings" size={15} /> },
    { key: "members", label: t("groups.tab_members", "Members"), icon: <Icon name="users" size={15} /> },
  ];
  return (
    <>
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {activeTab === "general" && <GeneralTab row={row} isNew={isNew} onChange={onChange} colTypes={colTypes} colScales={colScales} requiredFields={requiredFields} />}
        {activeTab === "members" && <MembersTab row={row} />}
      </div>
    </>
  );
}

const renderBody = (props: CrudPanelBodyProps) => <GroupTabs {...props} />;

const COLUMNS: ColumnDef<Row>[] = [
  { key: "group_id", locked: true },
  { key: "description" },
];

/* ── Page Component ──────────────────────────────────────── */
export default function GroupsPage({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const t = useT();
  return (
    <SplitCrudPage title={t("groups.title", "Groups")} table="groups"
      columns={COLUMNS} renderBody={renderBody}
      activeNav={activeNav} onNavigate={onNavigate} selectRecordOid={selectRecordOid} selectSeq={selectSeq} />
  );
}
