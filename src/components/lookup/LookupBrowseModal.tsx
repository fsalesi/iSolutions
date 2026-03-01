"use client";
import { useState, useEffect, useCallback } from "react";
import type { LookupConfig } from "./LookupTypes";

interface BrowseModalProps {
  config: LookupConfig;
  doFetch: (search: string, limit: number, offset: number) => Promise<{ rows: any[]; total: number }>;
  onSelect: (record: any) => void;
  onClose: () => void;
  selectedValues: string[];
  label?: string;
}

export function LookupBrowseModal({ config, doFetch, onSelect, onClose, selectedValues, label }: BrowseModalProps) {
  const { valueField, displayField, gridColumns, browseTitle } = config;
  const cols = gridColumns || [
    { key: valueField, label: valueField },
    ...(displayField !== valueField ? [{ key: displayField, label: displayField }] : []),
  ];

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const doSearch = useCallback(async (s: string, off: number) => {
    setLoading(true);
    try {
      const data = await doFetch(s, limit, off);
      setRows(data.rows);
      setTotal(data.total);
      setOffset(off);
    } finally {
      setLoading(false);
    }
  }, [doFetch]);

  // Initial load
  useEffect(() => { doSearch("", 0); }, []);

  // Search on type (debounced)
  useEffect(() => {
    const timer = setTimeout(() => doSearch(search, 0), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const title = browseTitle || `Select ${label || "Record"}`;
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "var(--bg-overlay)",
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
          maxWidth: 700,
          maxHeight: "80vh",
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

        {/* Search */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            autoFocus
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid var(--input-border)",
              borderRadius: 8,
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {cols.map(col => (
                  <th
                    key={String(col.key)}
                    style={{
                      padding: "8px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      textAlign: "left",
                      borderBottom: "1px solid var(--border)",
                      position: "sticky",
                      top: 0,
                      background: "var(--bg-surface)",
                    }}
                  >
                    {col.label || String(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isSelected = selectedValues.includes(String(row[valueField]));
                return (
                  <tr
                    key={String(row[valueField]) + i}
                    onClick={() => onSelect(row)}
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "var(--bg-selected)" : "transparent",
                      borderBottom: "1px solid var(--border-light)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isSelected ? "var(--bg-selected)" : "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = isSelected ? "var(--bg-selected)" : "transparent")}
                  >
                    {cols.map(col => (
                      <td
                        key={String(col.key)}
                        style={{
                          padding: "8px 12px",
                          fontSize: 13,
                          color: col.key === valueField ? "var(--text-primary)" : "var(--text-secondary)",
                          fontWeight: col.key === valueField ? 500 : 400,
                        }}
                      >
                        {String(row[col.key as string] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {loading && (
                <tr><td colSpan={cols.length} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={cols.length} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No results found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px",
          borderTop: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-muted)",
        }}>
          <span>{total} result{total !== 1 ? "s" : ""}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => doSearch(search, offset - limit)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: canPrev ? "pointer" : "default",
                background: "var(--bg-surface-alt)", border: "1px solid var(--border)",
                color: canPrev ? "var(--text-primary)" : "var(--text-muted)",
                opacity: canPrev ? 1 : 0.5,
              }}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => doSearch(search, offset + limit)}
              style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, cursor: canNext ? "pointer" : "default",
                background: "var(--bg-surface-alt)", border: "1px solid var(--border)",
                color: canNext ? "var(--text-primary)" : "var(--text-muted)",
                opacity: canNext ? 1 : 0.5,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
