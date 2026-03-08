"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import type { SavedFilter } from "./filter-types";
import { SEL } from "./filter-types";

function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12 }}>
      <span style={{ color: "var(--text-primary)" }}>{message}</span>
      <button onClick={onConfirm} style={{ padding: "2px 8px", borderRadius: 4, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Delete</button>
      <button onClick={onCancel} style={{ padding: "2px 8px", borderRadius: 4, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer", fontSize: 11 }}>Cancel</button>
    </div>
  );
}

function InlineSaveName({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void; }) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input ref={ref} type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder="Filter name…"
        style={{ ...SEL, flex: "0 1 160px", fontSize: 12 }}
        onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); if (e.key === "Escape") onCancel(); }} />
      <button onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}
        style={{ padding: "3px 10px", borderRadius: 4, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, opacity: name.trim() ? 1 : 0.4 }}>
        Save
      </button>
      <button onClick={onCancel} style={{ padding: "3px 8px", borderRadius: 4, color: "var(--text-muted)", border: "none", background: "none", cursor: "pointer", fontSize: 12 }}>
        Cancel
      </button>
    </div>
  );
}

export function SavedFiltersBar({ saved, activeName, onLoad, onSave, onSaveAs, onDelete, onSetDefault }: {
  saved: SavedFilter[]; activeName: string;
  onLoad: (s: SavedFilter) => void;
  onSave: (s: SavedFilter) => void;
  onSaveAs: (name: string) => void;
  onDelete: (s: SavedFilter) => void;
  onSetDefault: (s: SavedFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SavedFilter | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
      <Icon name="save" size={14} />
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>Saved:</span>

      <div style={{ position: "relative" }} ref={ref}>
        <button onClick={() => setOpen(!open)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)", minWidth: 150, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeName || "— None —"}</span>
          <Icon name="chevDown" size={12} />
        </button>
        {open && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 240, overflow: "hidden" }}>
            {saved.length === 0 && (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>No saved filters yet</div>
            )}
            {saved.map(s => (
              <div key={s.id}>
                {confirmDelete?.id === s.id ? (
                  <div style={{ padding: "8px 10px" }}>
                    <InlineConfirm message={`Delete "${s.name}"?`}
                      onConfirm={() => { onDelete(s); setConfirmDelete(null); }}
                      onCancel={() => setConfirmDelete(null)} />
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", cursor: "pointer" }}
                    onClick={() => { onLoad(s); setOpen(false); }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                      {s.is_default && (
                        <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--accent)", color: "#fff" }}>default</span>
                      )}
                    </span>
                    <button onClick={e => { e.stopPropagation(); onSetDefault(s); }}
                      title={s.is_default ? "Remove default" : "Set as default"}
                      style={{ padding: 3, borderRadius: 3, background: "none", border: "none", cursor: "pointer", color: s.is_default ? "var(--accent)" : "var(--text-muted)", opacity: 0.6 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; }}>
                      <Icon name="check" size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(s); }}
                      title="Delete"
                      style={{ padding: 3, borderRadius: 3, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", opacity: 0.6 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.opacity = "1"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.opacity = "0.6"; }}>
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {saving ? (
        <InlineSaveName
          onSave={name => { onSaveAs(name); setSaving(false); }}
          onCancel={() => setSaving(false)} />
      ) : (<>
        {activeName && (
          <button
            onClick={() => { const a = saved.find(s => s.name === activeName); if (a) onSave(a); }}
            style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-primary)", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
            Save
          </button>
        )}
        <button
          onClick={() => setSaving(true)}
          style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text-primary)", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover, rgba(0,0,0,0.04))"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "none"; }}>
          Save As…
        </button>
      </>)}
    </div>
  );
}
