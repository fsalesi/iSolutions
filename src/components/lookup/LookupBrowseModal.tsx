"use client";
// LookupBrowseModal — browse modal for lookup fields.
// Uses DataGridDef in mode:"lookup" + DataGridRenderer — no bespoke grid code.

import { useMemo } from "react";
import { DataGridDef } from "@/platform/core/DataGridDef";
import { ColumnDef }   from "@/platform/core/ColumnDef";
import { DataGridRenderer } from "@/components/grid/DataGridRenderer";
import type { LookupConfig } from "./LookupTypes";
import type { Row } from "@/platform/core/types";

interface LookupBrowseModalProps {
  config:         LookupConfig;
  onSelect:       (record: Row) => void;
  onClose:        () => void;
  selectedValues: string[];
  label?:         string;
}

export function LookupBrowseModal({
  config,
  onSelect,
  onClose,
  selectedValues,
  label,
}: LookupBrowseModalProps) {
  const { apiPath, valueField, gridColumns, browseTitle, dataSource } = config as any;

  const grid = useMemo(() => {
    const g = new DataGridDef({
      mode:        "lookup",
      pageSize:    20,
      allowSearch: true,
    });

    // Attach datasource if provided — preferred path
    if (dataSource) {
      g.dataSource = dataSource;
    } else if (apiPath) {
      // Legacy: apiPath on LookupConfig — wrap in a DataSourceDef
      const { DataSourceDef } = require("@/platform/core/DataSourceDef");
      g.dataSource = new DataSourceDef({ api: apiPath, table: apiPath.replace("/api/", "") });
    }

    // Override with explicit gridColumns if provided
    if (gridColumns?.length) {
      g.columns = gridColumns.map((c: any) =>
        new ColumnDef({ key: c.key, label: c.label ?? c.key, sortable: true })
      );
    }

    // Wire selection — fires back to the Lookup component
    g.onSelect = (row: Row) => {
      onSelect(row);
    };

    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Stable — recreated only when modal mounts

  const title = browseTitle || `Select ${label || "Record"}`;

  return (
    <div
      data-testid="lookup-browse-modal"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background:    "var(--bg-surface)",
          borderRadius:  12,
          boxShadow:     "var(--shadow-md)",
          width:         "90%",
          maxWidth:      800,
          height:        "80vh",
          display:       "flex",
          flexDirection: "column",
          overflow:      "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DataGridRenderer grid={grid} />
        </div>
      </div>
    </div>
  );
}
