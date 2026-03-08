"use client";
import { useState, useEffect, useCallback } from "react";
import type { LookupConfig } from "./LookupTypes";
import { DataGrid, type ColumnDef, type FetchPage } from "@/components/data-grid/DataGrid";

interface BrowseModalProps {
  config: LookupConfig;
  onSelect: (record: any) => void;
  onClose: () => void;
  selectedValues: string[];
  label?: string;
}

export function LookupBrowseModal({ config, onSelect, onClose, selectedValues, label }: BrowseModalProps) {
  const { apiPath, valueField, displayField, gridColumns, browseTitle, baseFilters, searchColumns } = config;

  const table = apiPath?.replace("/api/", "");
  const columnOverrides: ColumnDef<any>[] = gridColumns || [
    { key: valueField, locked: true },
  ];

  const fetchPage: FetchPage<any> = useCallback(async ({ offset, limit, search, sort, dir, filters }) => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    if (sort) { qs.set("sort", sort); qs.set("dir", dir); }

    if (baseFilters && Object.keys(baseFilters).length) {
      const baseTree = {
        type: "group" as const, logic: "and" as const,
        children: Object.entries(baseFilters).map(([field, value]) => ({
          type: "condition" as const, field, operator: "eq", value: String(value),
        })),
      };
      if (filters) {
        const userTree = JSON.parse(filters);
        qs.set("filters", JSON.stringify({ type: "group", logic: "and", children: [baseTree, userTree] }));
      } else {
        qs.set("filters", JSON.stringify(baseTree));
      }
    } else if (filters) {
      qs.set("filters", filters);
    }

    if (searchColumns?.length) qs.set("searchFields", searchColumns.join(","));

    const res = await fetch(`${apiPath}?${qs}`);
    if (!res.ok) return { rows: [], total: 0, offset, limit };
    const data = await res.json();
    return { rows: data.rows || [], total: data.total || 0, offset, limit };
  }, [apiPath, baseFilters, searchColumns]);

  const handleSelect = useCallback(async (oid: string) => {
    // Refetch the single record by oid to get the full row
    const res = await fetch(`${apiPath}?oid=${encodeURIComponent(oid)}&limit=1`);
    if (!res.ok) return;
    const data = await res.json();
    const row = data.rows?.[0];
    if (row) onSelect(row);
  }, [apiPath, onSelect]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const title = browseTitle || `Select ${label || "Record"}`;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: 12,
          boxShadow: "var(--shadow-md)",
          width: "90%",
          maxWidth: 800,
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 18, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* DataGrid */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <DataGrid
            table={table}
            columns={columnOverrides}
            fetchPage={fetchPage}
            selectedId={selectedValues[0] || null}
            onSelect={handleSelect}
            searchPlaceholder="Search..."
            pageSize={20}
            expanded={true}
          />
        </div>
      </div>
    </div>
  );
}
