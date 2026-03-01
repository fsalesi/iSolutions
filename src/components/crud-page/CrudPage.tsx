"use client";

import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { DataGrid, type ColumnDef, type FetchPage } from "@/components/data-grid/DataGrid";
import type { ColType } from "@/components/data-grid/AdvancedSearch";
import { CrudToolbar, type CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Icon } from "@/components/icons/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/TranslationContext";
import { AppShell } from "@/components/shell";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";

// ── Inline Confirm ──────────────────────────────────────────────
function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <span style={{ color: "var(--text-primary)" }}>{message}</span>
      <button onClick={onConfirm} className="px-2.5 py-1 rounded font-medium text-white"
        style={{ background: "#ef4444", fontSize: 11 }}>{t("crud.delete", "Delete")}</button>
      <button onClick={onCancel} className="px-2.5 py-1 rounded font-medium"
        style={{ color: "var(--text-muted)", fontSize: 11 }}>{t("crud.cancel", "Cancel")}</button>
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
  const t = useT();
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
          {t("crud.created", "Created")} {created}{createdBy ? ` by ${createdBy}` : ""}
        </span>
      )}
      {updated && (
        <span>
          {t("crud.updated", "Updated")} {updated}{updatedBy ? ` by ${updatedBy}` : ""}
          {onAuditClick && (
            <button
              onClick={onAuditClick}
              className="ml-1.5 underline transition-colors"
              style={{ color: "var(--accent)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--accent)"; }}
            >
              {t("crud.view_history", "View history")}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

// ── Standard audit columns for DataGrid ─────────────────────────
// AUDIT_GRID_COLUMNS moved inside CrudPage for i18n access

// ── Config types ────────────────────────────────────────────────

export interface CrudPageConfig<TRow extends { oid: string }> {
  /** Page title shown in header */
  title: string;
  /** API path (e.g. "/api/pasoe_brokers"). Drives ALL operations. */
  apiPath: string;
  /** Grid column overrides. Auto-generated from DB schema if omitted. */
  columns?: ColumnDef<TRow>[];

  /** The detail form renderer (optional if renderTabs provided) */
  renderDetail?: (props: {
    row: TRow;
    isNew: boolean;
    onChange: (field: keyof TRow, value: any) => void;
    colTypes: Record<string, string>;
    colScales: Record<string, number>;
  }) => ReactNode;



  /** Custom card renderer for the list. Default: uses first 2 columns. */
  renderCard?: (row: TRow, isSelected: boolean) => ReactNode;
  /** Tab-based detail form (replaces renderDetail when present) */
  renderTabs?: (props: {
    row: TRow;
    isNew: boolean;
    onChange: (field: keyof TRow, value: any) => void;
    colTypes: Record<string, string>;
    colScales: Record<string, number>;
  }) => ReactNode;
  /** Extra toolbar actions beyond the defaults */
  extraActions?: CrudAction[];

}


/** Convert snake_case column name to Title Case label */
function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\w/g, c => c.toUpperCase());
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
  const t = useT();

  const AUDIT_GRID_COLUMNS: ColumnDef<any>[] = useMemo(() => [
    { key: "created_at", label: t("crud.created", "Created") },
    { key: "created_by", label: t("crud.created_by", "Created By") },
    { key: "updated_at", label: t("crud.updated", "Updated") },
    { key: "updated_by", label: t("crud.updated_by", "Updated By") },
  ], [t]);

  const [colTypes, setColTypes] = useState<Record<string, ColType>>({});
  const [colScales, setColScales] = useState<Record<string, number>>({});

  // ── Auto-derive everything from apiPath ──
  const tableName = config.apiPath.replace("/api/", "");
  const xform = (raw: any) => raw as TRow;
  const gridId = tableName;
  const colTypesUrl = `/api/columns?table=${tableName}`;

  useEffect(() => {
    fetch(colTypesUrl).then(r => r.json()).then((cols: { key: string; type: string; scale?: number }[]) => {
      const typeMap: Record<string, ColType> = {};
      const scaleMap: Record<string, number> = {};
      for (const col of cols) {
        typeMap[col.key] = col.type as ColType;
        if (col.scale !== undefined) scaleMap[col.key] = col.scale;
      }
      setColTypes(typeMap);
      setColScales(scaleMap);
    }).catch(() => {});
  }, [colTypesUrl]);


  // Columns are now auto-discovered by DataGrid via the table prop.
  // config.columns are passed as overrides (locked, hidden, custom render, etc.)
  const columnOverrides = config.columns || [];

  const searchPlaceholder = `Search ${config.title.toLowerCase()}...`;
  const emptyIcon = "database";
  const emptyText = t("crud.no_records", "No records found.");
  const defaultVisible = columnOverrides.length > 0
    ? columnOverrides.filter(c => !c.hidden).map(c => String(c.key))
    : undefined; // let DataGrid show all
  const firstCol = String(columnOverrides[0]?.key || Object.keys(colTypes)[0] || "oid");
  const deleteLabel = (row: TRow) => String((row as any)[firstCol] || row.oid);
  const detailTitle = (row: TRow) => String((row as any)[firstCol] || t("crud.new", "New"));
  const searchCols = (defaultVisible || Object.keys(colTypes)).slice(0, 3);
  const exportCfg = { table: tableName, searchFields: searchCols, filename: `${tableName}-export` };
  const emptyRow = useCallback(() => {
    const row: any = { oid: "" };
    for (const [key, ct] of Object.entries(colTypes)) {
      if (ct === "boolean") row[key] = false;
      else if (ct === "number") row[key] = 0;
      else if (ct === "datetime" || ct === "date") row[key] = null;
      else row[key] = "";
    }
    return row as TRow;
  }, [colTypes]);

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
    // Clear validation errors
    document.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
    document.querySelectorAll('.fld-err-msg').forEach(el => el.remove());
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
    // Clear validation errors
    document.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
    document.querySelectorAll('.fld-err-msg').forEach(el => el.remove());
    if (isMobile) setMobileShowDetail(true);
    else setExpanded(false);
  }, [isMobile, config]);

  const handleSave = useCallback(async () => {
    // DOM-based required field validation
    const container = document.querySelector('[data-detail-body]');
    if (container) {
      // Clear previous errors
      container.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
      container.querySelectorAll('.fld-err-msg').forEach(el => el.remove());

      const missing: Element[] = [];
      container.querySelectorAll('[data-required]').forEach(fieldEl => {
        const input = fieldEl.querySelector('input, select, textarea') as HTMLInputElement | null;
        const val = input?.value?.trim() ?? '';
        if (!val) missing.push(fieldEl);
      });

      if (missing.length > 0) {
        missing.forEach(el => {
          el.classList.add('fld-err');
          const msg = document.createElement('div');
          msg.className = 'fld-err-msg text-xs mt-0.5';
          msg.style.color = 'var(--danger-text)';
          msg.textContent = el.getAttribute('data-required-msg') || t('validation.required', 'Required');
          el.appendChild(msg);
        });
        return;
      }
    }
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
      if (!res.ok) { setError(data.error || t("crud.save_failed", "Save failed")); setSaving(false); return; }
      const rec = xform(data);
      setSelectedRec(rec);
      setForm(rec);
      setSelectedOid(rec.oid);
      setIsDirty(false);
      setIsNew(false);
      setRefreshKey(k => k + 1);
    } catch { setError(t("crud.network_error", "Network error")); }
    setSaving(false);
  }, [form, isNew, config, t]);

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

  // Audit columns as overrides (DataGrid will merge with schema)
  const allColumnOverrides = useMemo(() => {
    const overrides = [...columnOverrides];
    for (const ac of AUDIT_GRID_COLUMNS) {
      if (!overrides.some(c => c.key === ac.key)) overrides.push(ac as ColumnDef<TRow>);
    }
    return overrides;
  }, [columnOverrides]);

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
        label: noteCount > 0 ? `${t("crud.notes", "Notes")} (${noteCount})` : t("crud.notes", "Notes"),
        disabled: isNew || !selectedRec,
        onClick: () => setNotesOpen(true),
      });
      filtered.push({
        key: "audit",
        icon: "shield",
        label: t("crud.audit", "Audit"),
        separator: true,
        disabled: isNew || !selectedRec,
        onClick: () => setAuditOpen(true),
      });
      return filtered;
    }
    return actions;
  }, [config.extraActions, auditTable, isNew, selectedRec, noteCount, t]);

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

  // Clear validation errors when user edits a field
  useEffect(() => {
    const container = document.querySelector('[data-detail-body]');
    if (!container) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      const fieldEl = target.closest('[data-required]');
      if (fieldEl?.classList.contains('fld-err')) {
        fieldEl.classList.remove('fld-err');
        fieldEl.querySelector('.fld-err-msg')?.remove();
      }
    };
    container.addEventListener('input', handler);
    container.addEventListener('change', handler);
    return () => {
      container.removeEventListener('input', handler);
      container.removeEventListener('change', handler);
    };
  });

  const detailProps = { row: form, isNew, onChange: handleFieldChange, colTypes, colScales };

  // Detail content: renderTabs owns the full area, renderDetail gets a scrollable wrapper.
  // In both cases, the footer is rendered OUTSIDE / AFTER the scrollable area.
  const detailBody = config.renderTabs
    ? config.renderTabs(detailProps)
    : (
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {config.renderDetail?.(detailProps)}
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
            table={tableName}
            columns={allColumnOverrides}
            defaultVisible={defaultVisible}
            fetchPage={fetchPage}
            selectedId={selectedOid}
            onSelect={handleSelect}
            searchPlaceholder={searchPlaceholder}
            renderCard={config.renderCard}
            expanded={expanded}
            onToggleExpand={() => setExpanded(e => !e)}
            colTypes={colTypes}
            colScales={colScales}
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

              <div data-detail-body>{detailBody}</div>

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
