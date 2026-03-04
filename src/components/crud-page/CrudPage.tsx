"use client";

import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { DataGrid, type ColumnDef, type FetchPage } from "@/components/data-grid/DataGrid";
import type { ColType } from "@/components/data-grid/AdvancedSearch";
import { CrudToolbar, type CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { Icon } from "@/components/icons/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";
import { useT } from "@/context/TranslationContext";
import { useConfirm } from "@/context/ConfirmContext";
import { AppShell } from "@/components/shell";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";

// ── Draggable Splitter ──────────────────────────────────────────
const DEFAULT_GRID_PCT = 30; // default grid width as % of container
const MIN_GRID_PCT = 15;
const MAX_GRID_PCT = 75;

function getSavedPct(tableName: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(`crud-split-${tableName}`);
    if (v) { const n = parseFloat(v); if (n >= MIN_GRID_PCT && n <= MAX_GRID_PCT) return n; }
  } catch {}
  return null;
}

function savePct(tableName: string, pct: number) {
  try { localStorage.setItem(`crud-split-${tableName}`, String(Math.round(pct * 10) / 10)); } catch {}
}

function clearPct(tableName: string) {
  try { localStorage.removeItem(`crud-split-${tableName}`); } catch {}
}

function useSplitter(tableName: string) {
  const savedPct = getSavedPct(tableName);
  const hasSaved = savedPct !== null;
  const [gridPct, setGridPct] = useState<number>(savedPct ?? DEFAULT_GRID_PCT);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(MIN_GRID_PCT, Math.min(MAX_GRID_PCT, pct));
      setGridPct(clamped);
      savePct(tableName, clamped);
    };
    const handleUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [tableName]);

  const resetToDefault = useCallback(() => {
    setGridPct(DEFAULT_GRID_PCT);
    clearPct(tableName);
  }, [tableName]);

  return { gridPct, hasSavedSplit: hasSaved, containerRef, onMouseDown, resetToDefault };
}

function SplitHandle({ onMouseDown, onReset }: {
  onMouseDown: (e: React.MouseEvent) => void;
  onReset: () => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => { e.preventDefault(); onReset(); }}
      className="flex-shrink-0 flex items-center justify-center"
      title="Drag to resize · Double-click to reset"
      style={{
        width: 7,
        cursor: "col-resize",
        background: "var(--border-light)",
        transition: "background 0.15s",
        zIndex: 5,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.opacity = "0.6"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--border-light)"; e.currentTarget.style.opacity = "1"; }}
    >
      <div style={{ width: 3, height: 32, borderRadius: 2, background: "var(--text-muted)", opacity: 0.35 }} />
    </div>
  );
}


// ── Inline Confirm ──────────────────────────────────────────────
export function InlineConfirm({ message, onConfirm, onCancel }: {
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
    requiredFields: string[];
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
    requiredFields: string[];
  }) => ReactNode;
  /** Extra toolbar actions beyond the defaults */
  extraActions?: CrudAction[];
  /** Default values for new rows (merged into emptyRow) */
  defaultValues?: Partial<TRow>;
  /** Pre-supplied column types (skips /api/columns fetch when provided) */
  initialColTypes?: Record<string, string>;
  /** Pre-supplied column scales */
  initialColScales?: Record<string, number>;
  /** Override the derived table name (used for audit/notes/columns). Default: derived from apiPath. */
  tableName?: string;

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
  const { user } = useSession();
  const t = useT();
  const confirm = useConfirm();

  const AUDIT_GRID_COLUMNS: ColumnDef<any>[] = useMemo(() => [
    { key: "created_at" },
    { key: "created_by" },
    { key: "updated_at" },
    { key: "updated_by" },
  ], []);

  const [colTypes, setColTypes] = useState<Record<string, ColType>>({});
  const [colScales, setColScales] = useState<Record<string, number>>({});
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const requiredFieldsSet = useRef(false);
  const [searchColumns, setSearchColumns] = useState<string[]>([]);
  const searchColumnsSet = useRef(false);

  // ── Auto-derive everything from apiPath ──
  const tableName = config.tableName || config.apiPath.replace("/api/", "");
  const xform = (raw: any) => raw as TRow;
  const gridId = tableName;
  const colTypesUrl = `/api/columns?table=${tableName}`;

  useEffect(() => {
    if (config.initialColTypes) {
      setColTypes(config.initialColTypes as Record<string, ColType>);
      if (config.initialColScales) setColScales(config.initialColScales);
      return;
    }
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
  }, [colTypesUrl, config.initialColTypes, config.initialColScales]);


  // Columns are now auto-discovered by DataGrid via the table prop.
  // config.columns are passed as overrides (locked, hidden, custom render, etc.)
  const columnOverrides = config.columns || [];

  const searchPlaceholder = t("crud.search_placeholder", "Search {title}...", { title: config.title.toLowerCase() });
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
    if (config.defaultValues) Object.assign(row, config.defaultValues);
    return row as TRow;
  }, [colTypes, config.defaultValues]);

  const genericFetchPage: FetchPage<TRow> = async ({ offset, limit, search, sort, dir, filters }) => {
    const params = new URLSearchParams({
      offset: String(offset), limit: String(limit), sort, dir,
      ...(search ? { search } : {}),
      ...(filters ? { filters } : {}),
    });
    const sep = config.apiPath.includes("?") ? "&" : "?"; const res = await fetch(`${config.apiPath}${sep}${params}`);
    return res.json();
  };
  const fetchPage: FetchPage<TRow> = async (params) => {
    const result = await genericFetchPage(params);
    if (result.requiredFields && !requiredFieldsSet.current) {
      requiredFieldsSet.current = true;
      setRequiredFields(result.requiredFields);
    }
    if (result.searchColumns && !searchColumnsSet.current) {
      searchColumnsSet.current = true;
      setSearchColumns(result.searchColumns);
    }
    return result;
  };



  const [selectedOid, setSelectedOid] = useState<string | null>(null);
  const [selectedRec, setSelectedRec] = useState<TRow | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    // If user has a saved split width, start in split view (not full-grid)
    if (typeof window === "undefined") return true;
    try { return !localStorage.getItem(`crud-split-${config.apiPath.replace("/api/", "")}`); } catch { return true; }
  });

  // ── Splitter (desktop only, %-based, persisted in localStorage) ──
  const { gridPct, hasSavedSplit, containerRef, onMouseDown: onSplitterMouseDown, resetToDefault: resetSplitter } = useSplitter(tableName);

  const [form, setForm] = useState<TRow>(emptyRow());
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [auditOpen, setAuditOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);


  // ── Dirty-form guard ──
  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    return confirm({ message: t("crud.unsaved_warning", "You have unsaved changes. Discard them?"), confirmLabel: t("crud.discard", "Discard") });
  }, [t, confirm]);

  // Browser close / refresh guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleSelect = useCallback(async (oid: string) => {
    if (!(await confirmDiscard())) return;
    setSelectedOid(oid);
    setIsNew(false);
    setIsDirty(false);
    setError("");
    setConfirmDelete(false);
    // Clear validation errors
    document.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
    document.querySelectorAll('.fld-err-msg').forEach(el => el.remove());
    fetch(`${config.apiPath}${config.apiPath.includes("?") ? "&" : "?"}oid=${encodeURIComponent(oid)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const raw = data.rows?.[0];
        if (raw) { const rec = xform(raw); setSelectedRec(rec); setForm({ ...rec }); }
      });
    if (isMobile) setMobileShowDetail(true);
    else setExpanded(false);
  }, [isMobile, config, confirmDiscard]);

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

  const handleNew = useCallback(async () => {
    if (!(await confirmDiscard())) return;
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
  }, [isMobile, config, confirmDiscard]);

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
    await fetch(`${config.apiPath}${config.apiPath.includes("?") ? "&" : "?"}oid=${selectedRec.oid}`, { method: "DELETE" });
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
    const extra = (config.extraActions || []).filter(a => a.key !== "audit" && a.key !== "notes");
    if (auditTable) {
      const actions: CrudAction[] = [];
      actions.push({
        key: "notes",
        icon: "messageSquare",
        label: t("crud.notes", "Notes"),
        highlight: noteCount > 0,
        disabled: isNew || !selectedRec,
        onClick: () => setNotesOpen(true),
      });
      actions.push({
        key: "audit",
        icon: "shield",
        label: t("crud.audit", "Audit"),
        separator: true,
        disabled: isNew || !selectedRec,
        onClick: () => setAuditOpen(true),
      });
      actions.push(...extra);
      return actions;
    }
    return extra;
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

  const detailProps = { row: form, isNew, onChange: handleFieldChange, colTypes, colScales, requiredFields };

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
    <AppShell title={shellTitle} showBack={mobileShowDetail} onBack={handleBack} activeNav={activeNav} onNavigate={async (k: string, oid?: string) => { if (!(await confirmDiscard())) return; onNavigate(k, oid); }}>
      <div ref={containerRef} className="flex flex-col lg:flex-row h-full overflow-hidden">

        {/* Left: Data Grid */}
        <div
          className={`
            ${isMobile && mobileShowDetail ? "hidden" : "flex"}
            ${isMobile ? "flex-1" : expanded ? "flex-1" : ""}
            flex-shrink-0 flex-col overflow-hidden
          `}
          style={{
            ...((!isMobile && !expanded) ? { width: `${gridPct}%` } : {}),
          }}
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
            searchColumns={searchColumns}
          />
        </div>

        {/* Drag splitter (desktop only, when detail is visible) */}
        {!isMobile && !expanded && <SplitHandle onMouseDown={onSplitterMouseDown} onReset={resetSplitter} />}

        {/* Right: Detail Panel */}
        <div
          className={`
            ${isMobile ? (mobileShowDetail ? "flex" : "hidden") : (expanded ? "hidden" : "flex")}
            flex-1 flex-col overflow-hidden
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
                    message={t("crud.confirm_delete", "Delete \"{record}\"?", { record: deleteLabel(selectedRec) })}
                    onConfirm={() => { handleDelete(); setConfirmDelete(false); }}
                    onCancel={() => setConfirmDelete(false)}
                  />
                </div>
              )}

              <div data-detail-body className="flex-1 overflow-y-auto">{detailBody}</div>

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
                <p className="text-sm mb-4">{emptyText}</p>
                <button onClick={handleNew} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: "var(--accent)", color: "var(--accent-text)" }} onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}><Icon name="plus" size={16} />{t("crud.new", "New")}</button>
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
