"use client";
import { useState, useEffect } from "react";
import { Section, Field, Input } from "@/components/ui";
import { SlidePanel } from "@/components/ui/SlidePanel";
import type { LayoutEntry } from "../types";

export function TabPropertiesPanel({ entry, open, onClose, onSaved, onDeleted, tabCount }: {
  entry: LayoutEntry | null; open: boolean;
  onClose: () => void;
  onSaved: (updated: LayoutEntry) => void;
  onDeleted: (oid: string) => void;
  tabCount: number;
}) {
  const [label, setLabel] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entry) {
      setLabel(entry.properties?.label || "");
      setSortOrder(entry.sort_order);
    }
  }, [entry?.oid]);

  const handleSave = async () => {
    if (!entry) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/form_layout?table=form_layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oid: entry.oid, _table: "form_layout",
          properties: { ...entry.properties, label },
          sort_order: sortOrder,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Save failed"); return; }
      const saved = await res.json();
      onSaved({ ...entry, properties: saved.properties || { ...entry.properties, label }, sort_order: sortOrder });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/form_layout?table=form_layout&oid=${entry.oid}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Delete failed"); return; }
      onDeleted(entry.oid);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); setConfirmDelete(false); }
  };

  if (!entry) return null;

  return (
    <SlidePanel open={open} onClose={onClose} title={`Tab: ${entry.layout_key}`}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save"}</button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 4px" }}>
        {error && (
          <div className="px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</div>
        )}
        <Field label="Label">
          <Input value={label} onChange={setLabel} />
        </Field>
        <Field label="Sort Order">
          <Input type="number" value={String(sortOrder)} onChange={v => setSortOrder(parseInt(v) || 0)} />
        </Field>
        {tabCount > 1 && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                Delete Tab</button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="text-sm" style={{ color: "#ef4444" }}>Sections will become unplaced. Continue?</span>
                <button onClick={handleDelete} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "#ef4444", color: "#fff" }}>Yes, Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>No</button>
              </div>
            )}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}

/* ── FormPage main component ── */
