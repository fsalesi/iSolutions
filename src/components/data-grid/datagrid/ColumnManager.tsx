"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { ColumnDef } from "./types";

export interface ColumnManagerState {
  visibleKeys: string[];
  setVisibleKeys: React.Dispatch<React.SetStateAction<string[]>>;
  allowedKeys: string[] | null;       // null = unrestricted
  toggleColumn: (key: string) => void;
  moveColumn: (key: string, direction: -1 | 1) => void;
  resetToDefault: () => void;
  hasUserPref: boolean;
  pickerOpen: boolean;
  setPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function useColumnManager<T>({
  columns, defaultVisible, gridId, userId,
}: {
  columns: ColumnDef<T>[];
  defaultVisible?: string[];
  gridId?: string;
  userId?: string;
}): ColumnManagerState {
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    () => defaultVisible || columns.map(c => c.key)
  );
  const [adminDefault, setAdminDefault] = useState<string[] | null>(null);
  const [allowedKeys, setAllowedKeys] = useState<string[] | null>(null);
  const [hasUserPref, setHasUserPref] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prefsLoaded = useRef(false);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  // Load persisted column prefs on mount
  useEffect(() => {
    if (!gridId) return;
    const params = new URLSearchParams({ grid: gridId });
    if (userId) params.set("user", userId);
    fetch(`/api/grid-prefs?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.allowedKeys) setAllowedKeys(data.allowedKeys);
        if (data.adminDefault) setAdminDefault(data.adminDefault);
        if (data.effective) setVisibleKeys(data.effective);
        setHasUserPref(!!data.userPref);
        prefsLoaded.current = true;
      })
      .catch(() => { prefsLoaded.current = true; });
  }, [gridId, userId]);

  // Sync visibleKeys when defaultVisible changes and no user pref saved
  useEffect(() => {
    if (defaultVisible && defaultVisible.length > 0 && !hasUserPref && prefsLoaded.current) {
      setVisibleKeys(prev => {
        if (prev.length < defaultVisible.length && defaultVisible.slice(0, prev.length).join() === prev.join()) {
          return defaultVisible;
        }
        return prev;
      });
    }
  }, [defaultVisible, hasUserPref]);

  const savePrefs = useCallback((keys: string[]) => {
    if (!gridId || !userId || !prefsLoaded.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/grid-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: gridId, user: userId, visible_keys: keys }),
      }).then(() => setHasUserPref(true)).catch(console.error);
    }, 800);
  }, [gridId, userId]);

  const toggleColumn = (key: string) => {
    // Respect allowedKeys — can't toggle on a column not in the allowed list
    if (allowedKeys && !allowedKeys.includes(key)) return;
    setVisibleKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      savePrefs(next);
      return next;
    });
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    setVisibleKeys(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      savePrefs(next);
      return next;
    });
  };

  const resetToDefault = () => {
    const def = adminDefault || defaultVisible || columns.map(c => c.key);
    setVisibleKeys(def);
    if (gridId && userId) {
      fetch("/api/grid-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grid: gridId, user: userId, visible_keys: null }),
      }).then(() => setHasUserPref(false)).catch(console.error);
    }
  };

  return { visibleKeys, setVisibleKeys, allowedKeys, toggleColumn, moveColumn, resetToDefault, hasUserPref, pickerOpen, setPickerOpen, pickerRef };
}

// ── Column Picker Dropdown ───────────────────────────────────────────────────
export function ColumnPicker<T>({
  allColumns, visibleKeys, allowedKeys, onToggle, onMove, onReset, hasUserPref,
}: {
  allColumns: ColumnDef<T>[];
  visibleKeys: string[];
  allowedKeys: string[] | null;       // null = show all columns
  onToggle: (key: string) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onReset: () => void;
  hasUserPref?: boolean;
}) {
  const t = useT();

  // Only show columns admin allows; if no restriction, show all
  const pickableColumns = allowedKeys
    ? allColumns.filter(c => allowedKeys.includes(c.key))
    : allColumns;

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 240, maxHeight: 400 }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
        <span>{t("crud.columns", "Columns")}</span>
        {hasUserPref && (
          <button onClick={onReset} className="text-xs hover:underline" style={{ color: "var(--accent)" }}>
            {t("crud.reset_to_default", "Reset to default")}
          </button>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {pickableColumns.map((col) => {
          const visible = visibleKeys.includes(col.key);
          const idx = visibleKeys.indexOf(col.key);
          const isLocked = col.locked;
          return (
            <div key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
              style={{ color: visible ? "var(--text-primary)" : "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <button onClick={() => !isLocked && onToggle(col.key)} className="flex-shrink-0"
                style={{ cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.4 : 1 }}>
                <Icon name={visible ? "check" : "x"} size={14}
                  style={{ color: visible ? "var(--accent)" : "var(--text-muted)" } as any} />
              </button>
              <span className="flex-1 truncate">{col.label}</span>
              {visible && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <button onClick={() => onMove(col.key, -1)} disabled={idx <= 0}
                    className="p-0.5 rounded" style={{ opacity: idx <= 0 ? 0.2 : 0.6, cursor: idx <= 0 ? "default" : "pointer" }}>
                    <Icon name="sortAsc" size={11} />
                  </button>
                  <button onClick={() => onMove(col.key, 1)} disabled={idx >= visibleKeys.length - 1}
                    className="p-0.5 rounded" style={{ opacity: idx >= visibleKeys.length - 1 ? 0.2 : 0.6, cursor: idx >= visibleKeys.length - 1 ? "default" : "pointer" }}>
                    <Icon name="sortDesc" size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
