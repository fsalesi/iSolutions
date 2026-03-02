"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@/components/icons/Icon";
import { useTranslation } from "@/context/TranslationContext";
import type { ColumnDef, SortState } from "./types";

export interface ExportConfig {
  table: string;
  searchFields: string[];
  filename?: string;
}

export interface ExportPanelState {
  exportKeys: string[];
  setExportKeys: React.Dispatch<React.SetStateAction<string[]>>;
  exportOpen: boolean;
  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportRef: React.RefObject<HTMLDivElement | null>;
}

export function useExportPanel({
  gridId, userId,
}: {
  gridId?: string;
  userId?: string;
}): ExportPanelState {
  const [exportKeys, setExportKeys] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportOpen]);

  return { exportKeys, setExportKeys, exportOpen, setExportOpen, exportRef };
}

export function ExportDropdown<T>({
  columns, exportKeys, setExportKeys, visibleKeys,
  exportConfig, search, sort, gridId, userId,
  onClose,
}: {
  columns: ColumnDef<T>[];
  exportKeys: string[];
  setExportKeys: React.Dispatch<React.SetStateAction<string[]>>;
  visibleKeys: string[];
  exportConfig: ExportConfig;
  search: string;
  sort: SortState;
  gridId?: string;
  userId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const toggleExportCol = (key: string) => {
    setExportKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      if (gridId && userId) {
        fetch("/api/grid-prefs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grid: gridId, user: userId, export_keys: next }),
        }).catch(console.error);
      }
      return next;
    });
  };

  const handleExport = async () => {
    if (exportKeys.length === 0) return;
    setExporting(true);
    try {
      const exportColumns = exportKeys
        .map(k => columns.find(c => c.key === k))
        .filter(Boolean)
        .map(c => ({ key: c!.key, label: c!.label || c!.key }));

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: exportConfig.table,
          columns: exportColumns,
          search,
          searchFields: exportConfig.searchFields,
          sort: sort.field,
          dir: sort.dir,
          filename: exportConfig.filename || exportConfig.table,
        }),
      });

      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportConfig.filename || exportConfig.table}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 260, maxHeight: 440 }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
        <span>Export Columns</span>
        <div className="flex gap-2">
          <button onClick={() => setExportKeys(columns.map(c => c.key))}
            className="text-xs hover:underline" style={{ color: "var(--accent)" }}>All</button>
          <button onClick={() => setExportKeys([...visibleKeys])}
            className="text-xs hover:underline" style={{ color: "var(--accent)" }}>Visible</button>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {columns.map(col => {
          const checked = exportKeys.includes(col.key);
          return (
            <div key={col.key}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors"
              style={{ color: checked ? "var(--text-primary)" : "var(--text-muted)" }}
              onClick={() => toggleExportCol(col.key)}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={checked ? "check" : "x"} size={14}
                style={{ color: checked ? "var(--accent)" : "var(--text-muted)" } as any} />
              <span className="flex-1 truncate">{col.label}</span>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border-light)" }}>
        <button onClick={handleExport}
          disabled={exporting || exportKeys.length === 0}
          className="w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          style={{
            background: exportKeys.length === 0 ? "var(--bg-surface-alt)" : "var(--accent)",
            color: exportKeys.length === 0 ? "var(--text-muted)" : "#fff",
            cursor: exportKeys.length === 0 ? "not-allowed" : "pointer",
            opacity: exporting ? 0.7 : 1,
          }}
        >
          <Icon name="download" size={14} />
          {exporting ? t("grid.exporting", "Exporting...") : `${t("grid.export", "Export")} ${exportKeys.length} columns`}
        </button>
      </div>
    </div>
  );
}
