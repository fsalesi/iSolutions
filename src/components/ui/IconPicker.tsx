"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Icon, BUILTIN_ICON_NAMES } from "@/components/icons/Icon";

const LUCIDE_ICON_NAMES = Object.keys(LucideIcons).filter(name =>
  /^[A-Z]/.test(name) && !name.endsWith("Icon")
);

export const ALL_ICON_NAMES = Array.from(new Set([
  ...BUILTIN_ICON_NAMES,
  ...LUCIDE_ICON_NAMES,
])).sort((a, b) => a.localeCompare(b));

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function IconPicker({ value, onChange, placeholder = "Search icons..." }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return ALL_ICON_NAMES;
    const query = filter.trim().toLowerCase();
    return ALL_ICON_NAMES.filter(name => name.toLowerCase().includes(query));
  }, [filter]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "7px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: "0.82rem",
          textAlign: "left",
        }}
      >
        {value ? (
          <>
            <Icon name={value} size={16} />
            <span style={{ flex: 1 }}>{value}</span>
          </>
        ) : (
          <span style={{ flex: 1, color: "var(--text-muted)" }}>No icon selected</span>
        )}
        <Icon name="chevDown" size={14} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 1000,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
            <input
              value={filter}
              onChange={event => setFilter(event.currentTarget.value)}
              placeholder={placeholder}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-surface-alt)",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
              }}
            />
          </div>
          <div style={{ padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setFilter("");
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 8px",
                borderRadius: 5,
                border: "none",
                background: value === "" ? "var(--accent-subtle, rgba(14,134,202,0.08))" : "transparent",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              No icon
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: 4,
              padding: 8,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {filtered.map(name => {
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                    setFilter("");
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "7px 5px",
                    borderRadius: 6,
                    border: active ? "1px solid var(--accent)" : "1px solid transparent",
                    background: active ? "var(--accent-subtle, rgba(14,134,202,0.08))" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.62rem",
                    overflow: "hidden",
                  }}
                >
                  <Icon name={name} size={16} />
                  <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                No icons match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
