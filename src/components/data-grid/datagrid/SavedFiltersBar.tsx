"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { SavedFilter } from "./filter-types";
import { SEL } from "./filter-types";

function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
      <span style={{ color: "var(--text-primary)" }}>{message}</span>
      <button onClick={onConfirm} className="px-2 py-0.5 rounded font-medium text-white"
        style={{ background: "#ef4444", fontSize: 11 }}>Delete</button>
      <button onClick={onCancel} className="px-2 py-0.5 rounded font-medium"
        style={{ color: "var(--text-muted)", fontSize: 11 }}>Cancel</button>
    </div>
  );
}

function InlineSaveName({ onSave, onCancel }: {
  onSave: (name: string) => void; onCancel: () => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex items-center gap-2">
      <input ref={ref} type="text" value={name} onChange={e => setName(e.target.value)}
        placeholder={t("filter.filter_name", "Filter name…")}
        className="text-xs px-2 py-1 rounded"
        style={{ ...SEL, flex: "0 1 160px", fontSize: 12 }}
        onKeyDown={e => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); if (e.key === "Escape") onCancel(); }} />
      <button onClick={() => name.trim() && onSave(name.trim())}
        disabled={!name.trim()}
        className="text-xs px-2 py-1 rounded font-medium disabled:opacity-30"
        style={{ background: "var(--accent)", color: "#fff", fontSize: 11 }}>Save</button>
      <button onClick={onCancel} className="text-xs px-2 py-1 rounded font-medium"
        style={{ color: "var(--text-muted)", fontSize: 11 }}>Cancel</button>
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
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SavedFilter | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="flex items-center gap-2 px-5 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
      <Icon name="save" size={14} />
      <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Saved:</span>

      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(!open)}
          className="flex items-center justify-between px-2.5 py-1 rounded text-xs font-medium"
          style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)", minWidth: 150 }}>
          <span className="truncate">{activeName || "— None —"}</span>
          <Icon name="chevDown" size={12} />
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-lg shadow-lg overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 240 }}>
            {saved.length === 0 && (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>No saved filters yet</div>
            )}
            {saved.map(s => (
              <div key={s.id}>
                {confirmDelete?.id === s.id ? (
                  <div className="px-3 py-2">
                    <InlineConfirm message={`Delete "${s.name}"?`}
                      onConfirm={() => { onDelete(s); setConfirmDelete(null); }}
                      onCancel={() => setConfirmDelete(null)} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface-alt)] cursor-pointer group"
                    onClick={() => { onLoad(s); setOpen(false); }}>
                    <span className="flex-1 text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {s.name}
                      {s.is_default && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "#fff" }}>default</span>}
                    </span>
                    <button onClick={e => { e.stopPropagation(); onSetDefault(s); }} title={s.is_default ? t("filter.remove_default", "Remove default") : t("filter.set_default", "Set as default")}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 transition-opacity"
                      style={{ color: s.is_default ? "var(--accent)" : "var(--text-muted)" }}>
                      <Icon name="check" size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(s); }} title="Delete"
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 transition-opacity"
                      style={{ color: "var(--text-muted)" }}>
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
          <button onClick={() => { const a = saved.find(s => s.name === activeName); if (a) onSave(a); }}
            className="text-xs px-2.5 py-1 rounded font-medium transition-colors hover:bg-[var(--bg-surface-alt)]"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            Save
          </button>
        )}
        <button onClick={() => setSaving(true)}
          className="text-xs px-2.5 py-1 rounded font-medium transition-colors hover:bg-[var(--bg-surface-alt)]"
          style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          Save As…
        </button>
      </>)}
    </div>
  );
}
