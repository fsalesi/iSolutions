"use client";

import {
  useState, useCallback, useEffect, useMemo, useRef,
  forwardRef, useImperativeHandle, type ReactNode,
} from "react";
import { Panel } from "./Panel";
import { InlineConfirm } from "./InlineConfirm";
import { AuditFooter } from "./AuditFooter";
import {
  CrudPanelContext,
  useChildRegistry,
  useRegisterWithParent,
  type CrudPanelRef,
} from "./CrudPanelContext";
import { CrudToolbar, type CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { useToolbarActions, type DesignAction } from "@/components/crud-toolbar/useToolbarActions";
import { ToolbarActionPropertiesPanel } from "@/components/crud-toolbar/ToolbarActionPropertiesPanel";
import { Icon } from "@/components/icons/Icon";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";
import { useT } from "@/context/TranslationContext";
import { useConfirm } from "@/context/ConfirmContext";

// ── Types ──

export interface CrudPanelBodyProps {
  row: Record<string, any>;
  isNew: boolean;
  onChange: (field: string, value: any) => void;
  colTypes: Record<string, string>;
  colScales: Record<string, number>;
  requiredFields: string[];
}

export interface CrudPanelProps {
  /** Row data — null means "no record selected" (show empty state) */
  row: Record<string, any> | null;
  /** Is this a new unsaved record? */
  isNew: boolean;
  /** API endpoint for save/delete operations */
  apiPath: string;
  /** Table name for audit trail, notes, and column schema */
  tableName: string;

  /** Form body renderer — parent provides the actual fields */
  renderBody: (props: CrudPanelBodyProps) => ReactNode;

  /** Callbacks to parent */
  onSaved: (saved: Record<string, any>) => void;
  onDeleted: () => void;
  onNew: () => void;
  onDirtyChange?: (dirty: boolean) => void;

  /** Default values for new rows (merged into auto-built empty row) */
  defaultValues?: Record<string, any>;
  /** Pre-supplied column metadata (overrides auto-fetched from /api/columns) */
  colTypes?: Record<string, string>;
  colScales?: Record<string, number>;
  requiredFields?: string[];
  /** Additional required fields stacked on top of requiredFields */
  extraRequiredFields?: string[];
  /** Extra toolbar actions */
  extraActions?: CrudAction[];
  /** Design-mode toggle (rendered by CrudToolbar for admins) */
  designMode?: boolean;
  onDesignToggle?: () => void;
  /** Form key — used to load/save toolbar action overrides */
  formKey?: string;
  /** Extra data merged into save payload (e.g. parent FK) */
  savePayloadExtras?: Record<string, any>;
  /** Custom empty state */
  renderEmpty?: () => ReactNode;
  /** Delete confirmation label */

  className?: string;
  style?: React.CSSProperties;
}

// ── CrudPanel ──

export const CrudPanel = forwardRef<CrudPanelRef, CrudPanelProps>(function CrudPanel(
  {
    row,
    isNew: isNewProp,
    apiPath,
    tableName,
    renderBody,
    onSaved,
    onDeleted,
    onNew,
    onDirtyChange,
    defaultValues,
    colTypes: colTypesProp,
    colScales: colScalesProp,
    requiredFields: requiredFieldsProp,
    extraRequiredFields,
    extraActions: extraActionsProp,
    designMode,
    onDesignToggle,
    formKey,
    savePayloadExtras,
    renderEmpty,
    className,
    style,
  },
  ref,
) {
  const t = useT();
  const confirm = useConfirm();

  // ── Schema self-fetch for colTypes/colScales (when not provided via props) ──
  const [autoColTypes, setAutoColTypes] = useState<Record<string, string>>({});
  const [autoColScales, setAutoColScales] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!tableName) return;
    // Skip fetch if metadata already provided via props
    if (colTypesProp && Object.keys(colTypesProp).length > 0) return;
    fetch(`/api/columns?table=${tableName}`)
      .then(r => r.json())
      .then((cols: { key: string; type: string; scale?: number }[]) => {
        const types: Record<string, string> = {};
        const scales: Record<string, number> = {};
        for (const col of cols) {
          types[col.key] = col.type;
          if (col.scale !== undefined) scales[col.key] = col.scale;
        }
        setAutoColTypes(types);
        setAutoColScales(scales);
      })
      .catch(() => {});
  }, [tableName, colTypesProp]);

  // Merge: props override auto-fetched
  const colTypes = colTypesProp && Object.keys(colTypesProp).length > 0
    ? colTypesProp : autoColTypes;
  const colScales = colScalesProp && Object.keys(colScalesProp).length > 0
    ? colScalesProp : autoColScales;
  // Required fields: from API prop + screen-level extras. No auto-inference from schema.
  const requiredFields = useMemo(
    () => [...(requiredFieldsProp || []), ...(extraRequiredFields || [])],
    [requiredFieldsProp, extraRequiredFields],
  );

  // ── Empty row builder (from schema + defaultValues) ──
  const buildEmptyRow = useCallback((): Record<string, any> => {
    const row: Record<string, any> = { oid: "" };
    for (const [key, ct] of Object.entries(colTypes)) {
      if (ct === "boolean") row[key] = false;
      else if (ct === "number") row[key] = 0;
      else if (ct === "datetime" || ct === "date") row[key] = null;
      else row[key] = "";
    }
    if (defaultValues) Object.assign(row, defaultValues);
    return row;
  }, [colTypes, defaultValues]);

  // ── CRUD state ──
  const [form, setForm] = useState<Record<string, any>>(row ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);

  // Keep dirtyRef in sync
  useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);
  // Notify parent of dirty changes
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  // ── Sync form when row prop changes ──
  useEffect(() => {
    if (row) {
      setForm(row);
    } else if (isNewProp) {
      setForm(buildEmptyRow());
    } else {
      setForm({});
    }
    setIsDirty(false);
    setError("");
    setConfirmDelete(false);
    // Clear DOM validation errors
    document.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
    document.querySelectorAll('.fld-err-msg').forEach(el => el.remove());
  }, [row, isNewProp, buildEmptyRow]);

  // ── Dirty-cascade context ──
  const { contextValue, canReleaseChildren } = useChildRegistry();

  // confirmDiscard for this panel
  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true;
    return confirm({
      message: t("crud.unsaved_warning", "You have unsaved changes. Discard them?"),
      confirmLabel: t("crud.discard", "Discard"),
    });
  }, [t, confirm]);

  // canRelease: check self, then children
  const selfRef = useMemo<CrudPanelRef>(() => ({
    canRelease: async () => {
      // Check self
      if (!(await confirmDiscard())) return false;
      // Check all registered children
      if (!(await canReleaseChildren())) return false;
      return true;
    },
  }), [confirmDiscard, canReleaseChildren]);

  // Expose via ref
  useImperativeHandle(ref, () => selfRef, [selfRef]);

  // Register with parent CrudPanel (if nested)
  useRegisterWithParent(selfRef);

  // ── beforeunload guard ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Field change ──
  const handleFieldChange = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setError("");
  }, []);

  // ── Required field validation (DOM-based) ──
  const validate = useCallback((): boolean => {
    const container = document.querySelector('[data-detail-body]');
    if (!container) return true;
    container.querySelectorAll('.fld-err').forEach(el => el.classList.remove('fld-err'));
    container.querySelectorAll('.fld-err-msg').forEach(el => el.remove());

    const missing: Element[] = [];
    container.querySelectorAll('[data-required]').forEach(fieldEl => {
      const input = fieldEl.querySelector('input, select, textarea') as HTMLInputElement | null;
      if (input) {
        if (!input.value.trim()) missing.push(fieldEl);
      } else {
        // Non-input field (Toggle, Lookup, etc.) — read from form state directly
        const fieldName = fieldEl.getAttribute('data-field-name');
        const val = fieldName != null ? form[fieldName] : undefined;
        if (val === null || val === undefined || val === '') missing.push(fieldEl);
      }
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
      return false;
    }
    return true;
  }, [t, form]);

  // Clear validation errors on input/change
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

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const isCreate = isNewProp || !form.oid;
      const payload = savePayloadExtras ? { ...form, ...savePayloadExtras } : form;
      const res = await fetch(apiPath, {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("crud.save_failed", "Save failed"));
        setSaving(false);
        return;
      }
      setForm(data);
      setIsDirty(false);
      onSaved(data);
    } catch {
      setError(t("crud.network_error", "Network error"));
    }
    setSaving(false);
  }, [form, isNewProp, apiPath, savePayloadExtras, validate, onSaved, t]);

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!form.oid) return;
    const sep = apiPath.includes("?") ? "&" : "?";
    await fetch(`${apiPath}${sep}oid=${encodeURIComponent(form.oid)}`, { method: "DELETE" });
    setConfirmDelete(false);
    onDeleted();
  }, [form, apiPath, onDeleted]);

  // ── Copy ──
  const handleCopy = useCallback(() => {
    setForm(prev => ({ ...prev, oid: "" }));
    setIsDirty(true);
    onNew(); // tells parent "we're now in new-record mode"
  }, [onNew]);

  // ── Note count fetch ──
  const recordOid = form?.oid || "";
  useEffect(() => {
    if (!tableName || !recordOid) { setNoteCount(0); return; }
    fetch(`/api/notes?table=${tableName}&oid=${recordOid}&count_only=true`)
      .then(r => r.json()).then(d => setNoteCount(d.count || 0)).catch(() => {});
  }, [tableName, recordOid]);

  // ── Extra actions (inject notes + audit) ──
  const allExtraActions = useMemo<CrudAction[]>(() => {
    const extra = (extraActionsProp || []).filter(a => a.key !== "audit" && a.key !== "notes");
    const actions: CrudAction[] = [];
    actions.push({
      key: "notes",
      icon: "messageSquare",
      label: t("crud.notes", "Notes"),
      highlight: noteCount > 0,
      disabled: isNewProp || !form.oid,
      onClick: () => setNotesOpen(true),
    });
    actions.push({
      key: "audit",
      icon: "shield",
      label: t("crud.audit", "Audit"),
      separator: true,
      disabled: isNewProp || !form.oid,
      onClick: () => setAuditOpen(true),
    });
    actions.push(...extra);
    return actions;
  }, [extraActionsProp, isNewProp, form.oid, noteCount, t]);

  // ── Toolbar actions with DB overrides ──
  const baseActionsForHook: CrudAction[] = [
    { key: "save",   icon: "save",  label: t("crud.save",   "Save"),   variant: "primary", disabled: !isDirty || saving, onClick: handleSave },
    { key: "new",    icon: "plus",  label: t("crud.new",    "New"),    onClick: onNew },
    { key: "delete", icon: "trash", label: t("crud.delete", "Delete"), variant: "danger",  disabled: isNewProp || !form.oid, onClick: () => setConfirmDelete(true) },
    { key: "copy",   icon: "copy",  label: t("crud.copy",   "Copy"),   onClick: handleCopy },
  ];
  const { visibleActions, allDesignActions, dbActions, setDbActions, reload: reloadToolbar } =
    useToolbarActions(formKey, tableName, baseActionsForHook, allExtraActions);

  // ── Toolbar designer state (owned here so reloadToolbar is accessible) ──
  const [selectedToolbarAction, setSelectedToolbarAction] = useState<DesignAction | null>(null);
  const [toolbarAddMode, setToolbarAddMode] = useState(false);
  const handleButtonDesignClick = (action: DesignAction) => setSelectedToolbarAction(action);
  const handleAddButton = () => setToolbarAddMode(true);
  const closeToolbarPanel = () => { setSelectedToolbarAction(null); setToolbarAddMode(false); };

  // ── Has record? ──
  const hasRecord = !!(row || isNewProp);
  const showFooter = hasRecord && !isNewProp && !!form.oid;

  // ── Render ──
  return (
    <CrudPanelContext.Provider value={contextValue}>
      <Panel
        className={className}
        style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-surface)", ...style }}
      >
        {hasRecord ? (
          <>
            <CrudToolbar
              onSave={handleSave}
              onNew={onNew}
              onDelete={() => setConfirmDelete(true)}
              onCopy={handleCopy}
              saveDisabled={!isDirty || saving}
              deleteDisabled={isNewProp || !form.oid}
              extraActions={allExtraActions}
              designMode={designMode}
              onDesignToggle={onDesignToggle}
              resolvedActions={designMode ? allDesignActions : (formKey ? visibleActions : undefined)}
              onButtonDesignClick={designMode ? handleButtonDesignClick : undefined}
              onAddButton={designMode ? handleAddButton : undefined}
            />

            {error && (
              <div
                className="mx-4 mt-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
              >
                {error}
              </div>
            )}

            {confirmDelete && form.oid && (
              <div className="mx-4 mt-2">
                <InlineConfirm
                  message={t("global.confirm_delete", "Are you sure you want to delete this record?")}
                  onConfirm={() => { handleDelete(); setConfirmDelete(false); }}
                  onCancel={() => setConfirmDelete(false)}
                />
              </div>
            )}

            <div data-detail-body className="flex-1 overflow-y-auto">
              {renderBody({
                row: form,
                isNew: isNewProp,
                onChange: handleFieldChange,
                colTypes,
                colScales,
                requiredFields,
              })}
            </div>

            {showFooter && (
              <AuditFooter
                row={form}
                onAuditClick={() => setAuditOpen(true)}
              />
            )}
          </>
        ) : (
          renderEmpty ? renderEmpty() : (
            <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
              <div className="text-center">
                <Icon name="database" size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-4">{t("crud.no_records", "No records found.")}</p>
                <button
                  onClick={onNew}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
                >
                  <Icon name="plus" size={16} />
                  {t("crud.new", "New")}
                </button>
              </div>
            </div>
          )
        )}
      </Panel>

      {/* Notes Panel */}
      <NotesPanel
        table={tableName}
        recordOid={recordOid}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        onCountChange={setNoteCount}
      />

      {/* Audit Panel */}
      <AuditPanel
        table={tableName}
        recordOid={recordOid}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      />
      {formKey && (
        <ToolbarActionPropertiesPanel
          action={selectedToolbarAction}
          open={!!selectedToolbarAction || toolbarAddMode}
          formKey={formKey}
          tableName={tableName}
          addMode={toolbarAddMode}
          onClose={closeToolbarPanel}
          onSaved={() => { closeToolbarPanel(); reloadToolbar(); }}
          onDeleted={() => { closeToolbarPanel(); reloadToolbar(); }}
        />
      )}
    </CrudPanelContext.Provider>
  );
});
