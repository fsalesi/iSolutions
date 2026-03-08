"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/icons/Icon";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AuditPanel } from "@/components/audit-panel/AuditPanel";
import { NotesPanel } from "@/components/notes-panel/NotesPanel";
import type { ToolbarDef, ButtonDef } from "@/platform/core/ToolbarDef";

interface PanelToolbarProps {
  toolbar:  ToolbarDef;
  isNew:    boolean;
  isDirty:  boolean;
  readOnly: boolean;
}

interface ToolBtn {
  key:       string;
  label:     string;
  icon:      string;
  onClick:   () => void;
  disabled?: boolean;
  hidden?:   boolean;
  danger?:   boolean;
}

export function PanelToolbar({ toolbar, isNew, isDirty, readOnly }: PanelToolbarProps) {
  const isMobile = useIsMobile();
  const [auditOpen, setAuditOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    toolbar.onRefresh = () => setTick(t => t + 1);
    return () => { toolbar.onRefresh = null; };
  }, [toolbar]);
  const [notesOpen, setNotesOpen] = useState(false);

  const hasRecord = !isNew && !!toolbar.panel?.currentRecord;
  const table     = toolbar.panel?.grid?.dataSource?.table  ?? "";
  const recordOid = toolbar.panel?.currentRecord?.oid ?? "";

  const builtins: ToolBtn[] = [
    { key: "new",    label: "New",    icon: "plus",   hidden: !toolbar.useNew    || readOnly, onClick: () => toolbar.onNew()    },
    { key: "save",   label: "Save",   icon: "save",   hidden: !toolbar.useSave   || readOnly, disabled: !isDirty && !isNew,  onClick: () => toolbar.onSave()   },
    { key: "copy",   label: "Copy",   icon: "copy",   hidden: !toolbar.useCopy   || readOnly, disabled: !hasRecord,          onClick: () => toolbar.onCopy()   },
    { key: "delete", label: "Delete", icon: "trash",  hidden: !toolbar.useDelete || readOnly, disabled: !hasRecord,          onClick: () => toolbar.onDelete(), danger: true },
    { key: "audit",  label: "Audit",  icon: "shield", hidden: !toolbar.useAudit,              disabled: !hasRecord,          onClick: () => { console.log("[Audit] table:", table, "recordOid:", recordOid, "hasRecord:", hasRecord, "currentRecord:", toolbar.panel?.currentRecord); setAuditOpen(true); } },
    { key: "notes",  label: "Notes",  icon: "messageSquare", hidden: !toolbar.useNotes, disabled: !hasRecord,          onClick: () => setNotesOpen(true) },
  ];

  const custom: ToolBtn[] = toolbar.buttons.map((b: ButtonDef) => ({
    key: b.key, label: b.label, icon: b.icon ?? "bolt",
    hidden: b.hidden, disabled: b.disabled || (b.requiresRecord && !hasRecord), onClick: b.onClick,
  }));

  const visible = [...builtins, ...custom].filter(b => !b.hidden);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", flexWrap: isMobile ? "wrap" : "nowrap", gap: 4, padding: "5px 8px", borderBottom: "1px solid var(--border)", background: "var(--bg-surface)", flexShrink: 0 }}>
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
