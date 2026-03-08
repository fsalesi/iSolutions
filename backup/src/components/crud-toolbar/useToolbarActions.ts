"use client";
/**
 * useToolbarActions — fetches DB overrides for a form's toolbar,
 * merges with base+extra actions, returns final sorted/filtered list.
 * Also used in design mode to expose raw DB records for editing.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import type { CrudAction } from "./CrudToolbar";

export type DbToolbarAction = {
  oid: string;
  form_key: string;
  table_name: string;
  action_key: string;
  label: string;
  icon: string;
  variant: string;
  separator: boolean;
  is_hidden: boolean;
  sort_order: number;
  is_standard: boolean;
  handler: string;
};

/** A toolbar action augmented with design-mode metadata */
export type DesignAction = CrudAction & {
  _sortOrder: number;
  _isCustom: boolean;
  _oid?: string;
  _isHidden: boolean;
  handler?: string;
};

const STANDARD_KEYS = new Set(["save", "new", "delete", "copy"]);

export function useToolbarActions(
  formKey: string | undefined,
  tableName: string | undefined,
  baseActions: CrudAction[],
  extraActions: CrudAction[],
) {
  const [dbActions, setDbActions] = useState<DbToolbarAction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(() => {
    if (!formKey || !tableName) return;
    setLoading(true);
    fetch(`/api/form_toolbar_actions?form_key=${encodeURIComponent(formKey)}&table_name=${encodeURIComponent(tableName)}`)
      .then(r => r.json())
      .then(d => setDbActions(d.rows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [formKey, tableName]);

  useEffect(() => { fetch_(); }, [fetch_]);

  /** All actions merged with DB overrides, sorted, hidden excluded */
  const actions = useMemo((): DesignAction[] => {
    const all = [...baseActions, ...extraActions];
    const dbMap = new Map(dbActions.map(a => [a.action_key, a]));

    const merged: DesignAction[] = all.map((action, i) => {
      const db = dbMap.get(action.key);
      const isStandard = STANDARD_KEYS.has(action.key);
      return {
        ...action,
        label: db?.label || action.label,
        icon: db?.icon || action.icon,
        variant: (db?.variant as any) || action.variant,
        separator: db != null ? db.separator : action.separator ?? false,
        _sortOrder: db?.sort_order ?? (isStandard ? i + 1 : 50 + i),
        _isCustom: !isStandard && !STANDARD_KEYS.has(action.key),
        _oid: db?.oid,
        _isHidden: db?.is_hidden ?? false,
        handler: db?.handler || "",
      };
    });

    // DB-only custom buttons (not in base or extra)
    const existingKeys = new Set(all.map(a => a.key));
    for (const db of dbActions) {
      if (!existingKeys.has(db.action_key)) {
        merged.push({
          key: db.action_key,
          label: db.label,
          icon: db.icon || "star",
          variant: db.variant as any,
          separator: db.separator,
          onClick: undefined,
          _sortOrder: db.sort_order,
          _isCustom: true,
          _oid: db.oid,
          _isHidden: db.is_hidden,
          handler: db.handler || "",
        });
      }
    }

    return merged.sort((a, b) => a._sortOrder - b._sortOrder);
  }, [baseActions, extraActions, dbActions]);

  /** Actions visible at runtime (not hidden) */
  const visibleActions = useMemo(() => actions.filter(a => !a._isHidden), [actions]);

  /** All actions including hidden — for design mode display */
  const allDesignActions = actions;

  return { visibleActions, allDesignActions, dbActions, setDbActions, reload: fetch_, loading };
}
