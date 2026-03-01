"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { DataGrid, type ColumnDef, type FetchPage } from "@/components/data-grid/DataGrid";
import type { ColType } from "@/components/data-grid/AdvancedSearch";
import { CrudToolbar, type CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Icon } from "@/components/icons/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/shell";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";

// ── Inline Confirm ──────────────────────────────────────────────
function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <span style={{ color: "var(--text-primary)" }}>{message}</span>
      <button onClick={onConfirm} className="px-2.5 py-1 rounded font-medium text-white"
        style={{ background: "#ef4444", fontSize: 11 }}>Delete</button>
      <button onClick={onCancel} className="px-2.5 py-1 rounded font-medium"
        style={{ color: "var(--text-muted)", fontSize: 11 }}>Cancel</button>
    </div>
  );
}

// ── Audit Footer ────────────────────────────────────────────────
function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function AuditFooter({ row, onAuditClick }: {
  row: Record<string, any>;
  onAuditClick?: () => void;
}) {
  const created = fmtStamp(row.created_at);
  const updated = fmtStamp(row.updated_at);
  const createdBy = row.created_by || "";
  const updatedBy = row.updated_by || "";

  if (!created && !updated) return null;

  return (
    <div
      className="flex items-center gap-x-4 gap-y-0.5 flex-wrap px-4 sm:px-5 py-2 text-[11px] flex-shrink-0"
      style={{ borderTop: "1px solid var(--border-light)", color: "var(--text-muted)" }}
    >
      {created && (
        <span>
          Created {created}{createdBy ? ` by ${createdBy}` : ""}
        </span>
      )}
      {updated && (
        <span>
          Updated {updated}{updatedBy ? ` by ${updatedBy}` : ""}
          {onAuditClick && (
            <button
              onClick={onAuditClick}
              className="ml-1.5 underline transition-colors"
              style={{ color: "var(--accent)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--accent)"; }}
            >
              View history
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// ── Standard audit columns for DataGrid ─────────────────────────
const AUDIT_GRID_COLUMNS: ColumnDef<any>[] = [
  { key: "created_at", label: "Created" },
  { key: "created_by", label: "Created By" },
  { key: "updated_at", label: "Updated" },
  { key: "updated_by", label: "Updated By" },
];

// ── Config types ────────────────────────────────────────────────

export interface CrudPageConfig<TRow extends { oid: string }> {
  /** Page title shown in header */
  title: string;
  /** API path (e.g. "/api/pasoe_brokers"). Drives ALL operations. */
  apiPath: string;
  /** Grid columns */
  columns: ColumnDef<TRow>[];

  /** The detail form renderer (optional if renderTabs provided) */
  renderDetail?: (props: {
    row: TRow;
    isNew: boolean;
    onChange: (field: keyof TRow, value: any) => void;
  }) => ReactNode;



  /** Custom card renderer for the list. Default: uses first 2 columns. */
  renderCard?: (row: TRow, isSelected: boolean) => ReactNode;
  /** Tab-based detail form (replaces renderDetail when present) */
  renderTabs?: (props: {
    row: TRow;
    isNew: boolean;
    onChange: (field: keyof TRow, value: any) => void;
  }) => ReactNode;
  /** Extra toolbar actions beyond the defaults */
  extraActions?: CrudAction[];

}

// ── CrudPage Component ──────────────────────────────────────────

export function CrudPage<TRow extends { oid: string }>({
  config,
  activeNav,
  onNavigate,
  selectRecordOid,
  selectSeq,
}: {
  config: CrudPageConfig<TRow>;
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // ── Auto-derive everything from apiPath ──
  const tableName = config.apiPath.replace("/api/", "");
  const xform = (raw: any) => raw as TRow;
  const gridId = tableName;
  const colTypesUrl = `/api/columns?table=${tableName}`;
  const searchPlaceholder = `Search ${config.title.toLowerCase()}...`;
  const emptyIcon = "database";
  const emptyText = "No records found.";
  const defaultVisible = config.columns.slice(0, 4).map(c => String(c.key));
  const firstCol = String(config.columns[0]?.key || "oid");
  const deleteLabel = (row: TRow) => String((row as any)[firstCol] || row.oid);
  const detailTitle = (row: TRow) => String((row as any)[firstCol] || "New");
  const searchCols = config.columns.filter(c => typeof c.key === "string").slice(0, 3).map(c => String(c.key));
  const exportCfg = { table: tableName, searchFields: searchCols, filename: `${tableName}-export` };
  const emptyRow = () => {
    const row: any = { oid: "" };
    for (const col of config.columns) row[col.key as string] = "";
    return row as TRow;
  };

  const genericFetchPage: FetchPage<TRow> = async ({ offset, limit, search, sort, dir, filters }) => {
    const params = new URLSearchParams({
      offset: String(offset), limit: String(limit), sort, dir,
      ...(search ? { search } : {}),
      ...(filters ? { filters } : {}),
    });
    const res = await fetch(`${config.apiPath}?${params}`);
    return res.json();
  };
  const fetchPage = genericFetchPage;

  const [colTypes, setColTypes] = useState<Record<string, ColType>>({});

  useEffect(() => {
    fetch(colTypesUrl).then(r => r.json()).then((cols: { key: string; type: string }[]) => {
      const map: Record<string, ColType> = {};
      for (const col of cols) map[col.key] = col.type as ColType;
      setColTypes(map);
    }).catch(() => {});
  }, [colTypesUrl]);

  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [selectedRec, setSelectedRec] = useState<TRow | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [form, setForm] = useState<TRow>(emptyRow());
  const [isDirty, setIsDirty] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [auditOpen, setAuditOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);


  const handleSelect = useCallback((oid: string) => {
    setSelectedOid(oid);
    setIsNew(false);
    setIsDirty(false);
    setError("");
    setConfirmDelete(false);
    fetch(`${config.apiPath}?oid=${encodeURIComponent(oid)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const raw = data.rows?.[0];
        if (raw) { const rec = xform(raw); setSelectedRec(rec); setForm({ ...rec }); }
      });
    if (isMobile) setMobileShowDetail(true);
    else setExpanded(false);
  }, [isMobile, config]);

  // ── Select record by OID (deep link / notification click) ──
  useEffect(() => {
    if (!selectRecordOid) return;
    handleSelect(selectRecordOid);
    setTimeout(() => setNotesOpen(true), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectSeq]);

  const handleFieldChange = useCallback((field: keyof TRow, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setError("");
  }, []);

  const handleBack = useCallback(() => setMobileShowDetail(false), []);

  const handleNew = useCallback(() => {
    setSelectedOid(null);
    setSelectedRec(null);
    setForm(emptyRow());
    setIsNew(true);
    setIsDirty(false);
    setError("");
    setConfirmDelete(false);
    if (isMobile) setMobileShowDetail(true);
    else setExpanded(false);
  }, [isMobile, config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const isCreate = isNew || !form.oid;
      const res = await fetch(config.apiPath, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); setSaving(false); return; }
      const rec = xform(data);
      setSelectedRec(rec);
      setForm(rec);
      setSelectedOid(rec.oid);
      setIsDirty(false);
      setIsNew(false);
      setRefreshKey(k => k + 1);
    } catch { setError("Network error"); }
    setSaving(false);
  }, [form, isNew, config]);

  const handleDelete = useCallback(async () => {
    if (!selectedRec) return;
    await fetch(`${config.apiPath}?oid=${selectedRec.oid}`, { method: "DELETE" });
    setSelectedOid(null);
    setSelectedRec(null);
    setForm(emptyRow());
    setIsDirty(false);
    setIsNew(false);
    setConfirmDelete(false);
    setExpanded(true);
    setRefreshKey(k => k + 1);
  }, [selectedRec, config]);

  const handleCopy = useCallback(() => {
    setForm(prev => ({ ...prev, oid: "" }));
    setSelectedOid(null);
    setSelectedRec(null);
    setIsNew(true);
    setIsDirty(true);
  }, [config]);

  const hasRecord = !!(selectedRec || isNew);

  // ── Auto-inject audit columns into DataGrid ────────────────
  const allColumns = useMemo(() => {
    const existing = new Set(config.columns.map(c => c.key));
    const extra = AUDIT_GRID_COLUMNS.filter(c => !existing.has(c.key));
    return [...config.columns, ...extra] as ColumnDef<TRow>[];
  }, [config.columns]);

  // ── Auto-derive audit table from exportConfig ──────────────
  const auditTable = tableName;

  // ── Build extraActions: inject audit button if table is known ──
  const allExtraActions = useMemo<CrudAction[]>(() => {
    const actions = [...(config.extraActions || [])];
    if (auditTable) {
      const filtered = actions.filter(a => a.key !== "audit" && a.key !== "notes");
      filtered.push({
        key: "notes",
        icon: "messageSquare",
        label: noteCount > 0 ? `Notes (${noteCount})` : "Notes",
        disabled: isNew || !selectedRec,
        onClick: () => setNotesOpen(true),
      });
      filtered.push({
        key: "audit",
        icon: "shield",
        label: "Audit",
        separator: true,
        disabled: isNew || !selectedRec,
        onClick: () => setAuditOpen(true),
      });
      return filtered;
    }
    return actions;
  }, [config.extraActions, auditTable, isNew, selectedRec, noteCount]);

  const auditRecordOid = useMemo(() => {
    if (!auditTable || !form) return "";
    return (form as any).oid || "";
  }, [auditTable, form]);

  // ── Fetch note count when record changes ──
  useEffect(() => {
    if (!auditTable || !auditRecordOid) { setNoteCount(0); return; }
    fetch(`/api/notes?table=${auditTable}&oid=${auditRecordOid}&count_only=true`)
      .then(r => r.json()).then(d => setNoteCount(d.count || 0)).catch(() => {});
  }, [auditTable, auditRecordOid]);

  const shellTitle = isMobile && mobileShowDetail && selectedRec && detailTitle
    ? detailTitle(selectedRec)
    : config.title;

  const detailProps = { row: form, isNew, onChange: handleFieldChange };

  // Detail content: renderTabs owns the full area, renderDetail gets a scrollable wrapper.
  // In both cases, the footer is rendered OUTSIDE / AFTER the scrollable area.
  const detailBody = config.renderTabs
    ? config.renderTabs(detailProps)
    : (
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {config.renderDetail(detailProps)}
      </div>
    );

  // Show footer for existing records (not new)
  const showFooter = hasRecord && !isNew && !!form.oid;

  return (
    <AppShell title={shellTitle} showBack={mobileShowDetail} onBack={handleBack} activeNav={activeNav} onNavigate={onNavigate}>
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">

        {/* Left: Data Grid */}
        <div
          className={`
            ${isMobile && mobileShowDetail ? "hidden" : "flex"}
            ${isMobile ? "flex-1" : expanded ? "flex-1" : "w-[420px] xl:w-[480px]"}
            flex-shrink-0 flex-col overflow-hidden transition-all duration-200
          `}
          style={{ borderRight: isMobile ? "none" : expanded ? "none" : "1px solid var(--border)" }}
        >
          <DataGrid<TRow>
            key={refreshKey}
            columns={allColumns}
            defaultVisible={defaultVisible}
            fetchPage={fetchPage}
            selectedId={selectedOid}
            onSelect={handleSelect}
            searchPlaceholder={searchPlaceholder}
            renderCard={config.renderCard}
            expanded={expanded}
            onToggleExpand={() => setExpanded(e => !e)}
            colTypes={colTypes}
            gridId={gridId}
            userId={user.userId}
            exportConfig={exportCfg}
          />
        </div>

        {/* Right: Detail Panel */}
        <div
          className={`
            ${isMobile ? (mobileShowDetail ? "flex" : "hidden") : (expanded ? "hidden" : "flex")}
            flex-1 flex-col overflow-hidden transition-all duration-200
          `}
          style={{ background: "var(--bg-surface)" }}
        >
          {hasRecord ? (
            <>
              <CrudToolbar
                onSave={handleSave}
                onNew={handleNew}
                onDelete={() => setConfirmDelete(true)}
                onCopy={handleCopy}
                saveDisabled={!isDirty || saving}
                deleteDisabled={isNew || !form.oid}
                extraActions={allExtraActions}
              />

              {error && (
                <div className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {error}
                </div>
              )}
              {confirmDelete && selectedRec && (
                <div className="mx-4 mt-2">
                  <InlineConfirm
                    message={`Delete "${deleteLabel(selectedRec)}"?`}
                    onConfirm={() => { handleDelete(); setConfirmDelete(false); }}
                    onCancel={() => setConfirmDelete(false)}
                  />
                </div>
              )}

              {detailBody}

              {showFooter && (
                <AuditFooter
                  row={form as Record<string, any>}
                  onAuditClick={auditTable ? () => setAuditOpen(true) : undefined}
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <div className="text-center">
                <Icon name={emptyIcon} size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{emptyText}</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Notes Panel */}
      {auditTable && (
        <NotesPanel
          table={auditTable}
          recordOid={auditRecordOid}
          open={notesOpen}
          onClose={() => setNotesOpen(false)}
          onCountChange={setNoteCount}
        />
      )}

      {/* Audit Panel */}
      {auditTable && (
        <AuditPanel
          table={auditTable}
          recordOid={auditRecordOid}
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </AppShell>
  );
}
