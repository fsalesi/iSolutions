"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/icons/Icon";
import { useTranslation } from "@/context/TranslationContext";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";
import type { ToolbarDef, ButtonDef } from "@/platform/core/ToolbarDef";
import { useSession } from "@/context/SessionContext";
import { ToolbarDesigner, applyToolbarDefaults } from "@/platform/core/ToolbarDesigner";
import { DrawerService } from "@/platform/core/DrawerService";

interface PanelToolbarProps {
  toolbar: ToolbarDef;
  designEnabled?: boolean;
}

interface ToolBtn {
  key:       string;
  label:     string;
  icon:      string;
  onClick:   () => void;
  disabled?: boolean;
  hidden?:   boolean;
  danger?:   boolean;
  sortOrder?: number;
}

export function PanelToolbar({ toolbar, designEnabled = false }: PanelToolbarProps) {
  const { locale } = useTranslation();
  const isMobile = useIsMobile();
  const { user } = useSession();
  const canDesignPanel = !!user?.isAdmin && designEnabled;
  const [auditOpen, setAuditOpen] = useState(false);
  const [, setTick] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    applyToolbarDefaults(toolbar).then(() => {
      toolbar.refresh();
    });
  }, [toolbar]);

  useEffect(() => {
    toolbar.onRefresh = () => setTick(t => t + 1);
    return () => { toolbar.onRefresh = null; };
  }, [toolbar]);

  const panel = toolbar.panel;
  const isNew = panel?.isNew ?? false;
  const isDirty = panel?.isDirty ?? false;
  const readOnly = panel?.readOnly ?? false;
  const hasRecord = !isNew && !!panel?.currentRecord;
  const table = panel?.grid?.dataSource?.table ?? "";
  const recordOid = panel?.currentRecord?.oid ?? "";

  const builtins: ToolBtn[] = [
    { key: "new",    label: resolveClientText(tx("panel.actions.new", "New")),       icon: "plus",          sortOrder: toolbar.buttonSortOrder.new ?? 10, hidden: !toolbar.useNew,    disabled: readOnly,                   onClick: () => toolbar.onNew() },
    { key: "save",   label: resolveClientText(tx("panel.actions.save", "Save")),      icon: "save",          sortOrder: toolbar.buttonSortOrder.save ?? 20, hidden: !toolbar.useSave,   disabled: readOnly || (!isDirty && !isNew), onClick: () => toolbar.onSave() },
    { key: "copy",   label: resolveClientText(tx("panel.actions.copy", "Copy")),      icon: "copy",          sortOrder: toolbar.buttonSortOrder.copy ?? 30, hidden: !toolbar.useCopy,   disabled: readOnly || !hasRecord,      onClick: () => toolbar.onCopy() },
    { key: "delete", label: resolveClientText(tx("panel.actions.delete", "Delete")),  icon: "trash",         sortOrder: toolbar.buttonSortOrder.delete ?? 40, hidden: !toolbar.useDelete, disabled: readOnly || !hasRecord,      onClick: () => toolbar.onDelete(), danger: true },
    { key: "audit",  label: resolveClientText(tx("panel.actions.audit", "Audit")),    icon: "shield",        sortOrder: toolbar.buttonSortOrder.audit ?? 50, hidden: !toolbar.useAudit,  disabled: !hasRecord,                  onClick: () => setAuditOpen(true) },
    { key: "notes",  label: resolveClientText(tx("panel.actions.notes", "Notes")),    icon: "messageSquare", sortOrder: toolbar.buttonSortOrder.notes ?? 60, hidden: !toolbar.useNotes,  disabled: !hasRecord,                  onClick: () => setNotesOpen(true) },
  ];

  const custom: ToolBtn[] = toolbar.buttons
    .slice()
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999))
    .map((b: ButtonDef, i: number) => {
      const hidden = !!b.hidden || (!!b.hiddenWhenReadOnly && readOnly);
      const disabled = !!b.disabled
        || (!!b.requiresRecord && !hasRecord)
        || (!!b.disabledWhenNew && isNew)
        || (!!b.disabledWhenDirty && isDirty)
        || (!!b.disabledWhenReadOnly && readOnly);

      return {
        key: b.key,
        label: resolveClientText(b.label),
        icon: b.icon ?? "bolt",
        sortOrder: b.sortOrder ?? (100 + i * 10),
        hidden,
        disabled,
        onClick: () => { void toolbar.clickButton(b); },
      };
    });

  const visible = [...builtins, ...custom]
    .filter(b => !b.hidden)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));

  return (
    <>
      <div key={locale} style={{ display: "flex", alignItems: "center", flexWrap: isMobile ? "wrap" : "nowrap", gap: 4, padding: "5px 8px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
        {visible.map((btn, i) => {
          const divider = btn.key === "delete" && i > 0;
          return (
            <span key={btn.key} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, maxWidth: isMobile ? "100%" : undefined }}>
              {divider && <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px" }} />}
              <button
                data-testid={`panel-toolbar-${btn.key}`}
                onClick={btn.onClick}
                disabled={btn.disabled}
                title={btn.label}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 5,
                  minWidth: 0,
                  maxWidth: isMobile ? "100%" : undefined,
                  border:      btn.danger ? "1px solid var(--danger-border, #fc8181)" : "1px solid var(--border)",
                  background:  btn.danger ? "transparent" : "var(--bg-surface-alt)",
                  color:       btn.danger ? "var(--danger, #e53e3e)" : btn.disabled ? "var(--text-muted)" : "var(--text-primary)",
                  fontSize: "0.78rem", fontWeight: 500,
                  cursor:   btn.disabled ? "not-allowed" : "pointer",
                  opacity:  btn.disabled ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = btn.danger ? "rgba(229,62,62,0.08)" : "var(--bg-hover, rgba(0,0,0,0.06))"; }}
                onMouseLeave={e => { e.currentTarget.style.background = btn.danger ? "transparent" : "var(--bg-surface-alt)"; }}
              >
                <Icon name={btn.icon} size={13} />
                {!isMobile && btn.label}
              </button>
            </span>
          );
        })}
        {canDesignPanel && (
          <>
            <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 2px 0 auto" }} />
            <button
              onClick={() => DrawerService.push(new ToolbarDesigner(toolbar))}
              title="Toolbar Designer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "4px 10px", borderRadius: 5,
                border: "1px solid var(--border)",
                background: "var(--bg-surface-alt)",
                color: "var(--text-muted)",
                fontSize: "0.78rem", fontWeight: 500, cursor: "pointer",
                alignSelf: "stretch",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Icon name="settings" size={14} />
            </button>
          </>
        )}
      </div>

      <AuditPanel
        table={table}
        recordOid={recordOid}
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
      />
      <NotesPanel
        table={table}
        recordOid={recordOid}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    </>
  );
}
