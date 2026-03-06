"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import { useSession } from "@/context/SessionContext";
import type { DesignAction } from "./useToolbarActions";

export type CrudAction = {
  key: string;
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "default";
  /** Separator before this action */
  separator?: boolean;
  /** Highlight the button (e.g. notes exist) */
  highlight?: boolean;
};

interface CrudToolbarProps {
  onSave?: () => void;
  onNew?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  saveDisabled?: boolean;
  deleteDisabled?: boolean;
  extraActions?: CrudAction[];
  designMode?: boolean;
  onDesignToggle?: () => void;
  /** Design mode: called when a button is clicked for editing */
  onButtonDesignClick?: (action: DesignAction) => void;
  /** Design mode: called when "Add Button" is clicked */
  onAddButton?: () => void;
  /** Merged+overridden actions from useToolbarActions (replaces internal baseActions+extra) */
  resolvedActions?: DesignAction[];
  children?: ReactNode;
}

export function CrudToolbar({
  onSave, onNew, onDelete, onCopy,
  saveDisabled, deleteDisabled,
  extraActions = [],
  designMode, onDesignToggle,
  onButtonDesignClick, onAddButton,
  resolvedActions,
}: CrudToolbarProps) {
  const t = useT();

  // Fallback: if no resolvedActions provided, build the standard set
  const baseActions: CrudAction[] = [
    { key: "save",   icon: "save",  label: t("crud.save",   "Save"),   variant: "primary", disabled: saveDisabled,   onClick: onSave },
    { key: "new",    icon: "plus",  label: t("crud.new",    "New"),                                                  onClick: onNew },
    { key: "delete", icon: "trash", label: t("crud.delete", "Delete"), variant: "danger",  disabled: deleteDisabled, onClick: onDelete },
    { key: "copy",   icon: "copy",  label: t("crud.copy",   "Copy"),                                                 onClick: onCopy },
  ];

  const actions = resolvedActions ?? ([...baseActions, ...extraActions] as DesignAction[]);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2 flex-wrap flex-shrink-0"
      style={{ background: "var(--bg-surface-alt)", borderBottom: "1px solid var(--border)" }}
    >
      {actions.map(action => (
        <span key={action.key} className="contents">
          {action.separator && (
            <div className="w-px h-6 mx-0.5 hidden sm:block" style={{ background: "var(--border)" }} />
          )}
          {designMode && onButtonDesignClick ? (
            <DesignActionButton action={action} onClick={() => onButtonDesignClick(action)} />
          ) : (
            <ActionButton action={action} />
          )}
        </span>
      ))}

      {designMode && onAddButton && (
        <>
          <div className="w-px h-6 mx-0.5 hidden sm:block" style={{ background: "var(--border)" }} />
          <button
            onClick={onAddButton}
            title="Add toolbar button"
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md"
            style={{
              background: "transparent",
              color: "var(--accent)",
              border: "1px dashed var(--accent)",
              cursor: "pointer",
            }}
          >
            <Icon name="plus" size={13} />
            <span className="hidden sm:inline">Add Button</span>
          </button>
        </>
      )}
    </div>
  );
}

/** Normal runtime button */
function ActionButton({ action }: { action: CrudAction }) {
  const { icon, label, onClick, disabled, variant = "default", highlight } = action;

  let bg: string, color: string, border: string, hoverBg: string;

  if (disabled) {
    bg = "var(--bg-surface-alt)"; color = "var(--text-muted)"; border = "transparent"; hoverBg = bg;
  } else if (variant === "primary") {
    bg = "var(--accent)"; color = "var(--accent-text)"; border = "transparent"; hoverBg = "var(--accent-hover)";
  } else if (variant === "danger") {
    bg = "transparent"; color = "var(--danger-text)"; border = "var(--danger-border)"; hoverBg = "var(--danger-bg)";
  } else {
    bg = "transparent"; color = "var(--text-secondary)"; border = "var(--border)"; hoverBg = "var(--bg-hover)";
  }

  if (highlight && !disabled) {
    color = "var(--section-title)"; border = "var(--section-title)"; bg = "rgba(14,134,202,0.08)";
    hoverBg = "rgba(14,134,202,0.12)";
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all"
      style={{
        background: bg, color,
        border: `1px solid ${border}`,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: variant === "primary" && !disabled ? "var(--shadow-sm)" : "none",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = bg; }}
    >
      <Icon name={icon} size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** Design-mode button wrapper: dashed outline, click → edit */
function DesignActionButton({ action, onClick }: { action: CrudAction; onClick: () => void }) {
  const { icon, label, variant = "default" } = action;
  const isHidden = (action as DesignAction)._isHidden;

  return (
    <button
      onClick={onClick}
      title="Click to edit this button"
      className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-all"
      style={{
        background: isHidden ? "var(--bg-secondary)" : "transparent",
        color: isHidden ? "var(--text-muted)" : (variant === "primary" ? "var(--accent)" : variant === "danger" ? "var(--danger-text)" : "var(--text-secondary)"),
        border: `1px dashed ${isHidden ? "var(--border)" : "var(--accent)"}`,
        cursor: "pointer",
        opacity: isHidden ? 0.5 : 1,
        position: "relative",
      }}
    >
      <Icon name={icon} size={14} />
      <span className="hidden sm:inline">{label}</span>
      {isHidden && (
        <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 2 }}>hidden</span>
      )}
    </button>
  );
}
