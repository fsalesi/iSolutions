"use client";
import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import { Input } from "@/components/ui";

export const ALL_ICONS = [
  "activity", "arrowLeft", "ban", "bell", "briefcase", "camera", "chart",
  "check", "chevDown", "chevFirst", "chevLast", "chevLeft", "chevRight", "chevUp",
  "clock", "collapse", "columns", "copy", "download", "edit", "expand",
  "filter", "globe", "key", "list", "lock", "logOut", "mail", "menu",
  "messageSquare", "moon", "plus", "rotate-ccw", "save", "search", "server",
  "settings", "shield", "sortAsc", "sortDesc", "sun", "tag", "trash",
  "undo", "unlock", "upload", "user", "users", "x",
];

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = filter
    ? ALL_ICONS.filter(n => n.toLowerCase().includes(filter.toLowerCase()))
    : ALL_ICONS;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "6px 10px", borderRadius: 6,
          border: "1px solid var(--border)", background: "var(--bg-input)",
          color: "var(--text-primary)", cursor: "pointer", fontSize: 13, textAlign: "left",
        }}
      >
        {value ? (
          <><Icon name={value} size={16} /><span style={{ flex: 1 }}>{value}</span></>
        ) : (
          <span style={{ flex: 1, color: "var(--text-muted)" }}>— none —</span>
        )}
        <Icon name="chevDown" size={14} />
      </button>

      {open && (
        <div style={{
          position: "absolute", zIndex: 1000, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", overflow: "hidden",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
            <Input value={filter} onChange={setFilter} placeholder="Search icons…" />
          </div>
          <div style={{ padding: "4px 6px", borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setFilter(""); }}
              style={{
                display: "block", width: "100%", padding: "5px 8px", borderRadius: 5,
                border: "none", background: value === "" ? "var(--accent-subtle)" : "transparent",
                color: "var(--text-muted)", fontSize: 12, cursor: "pointer", textAlign: "left",
              }}
            >
              — none —
            </button>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
            gap: 2, padding: 6, maxHeight: 240, overflowY: "auto",
          }}>
            {filtered.map(name => (
              <button
                key={name} type="button" title={name}
                onClick={() => { onChange(name); setOpen(false); setFilter(""); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  padding: "6px 4px", borderRadius: 6, fontSize: 9, cursor: "pointer", overflow: "hidden",
                  border: name === value ? "1px solid var(--accent)" : "1px solid transparent",
                  background: name === value ? "var(--accent-subtle)" : "transparent",
                  color: name === value ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <Icon name={name} size={16} />
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1/-1", padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No icons match
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
