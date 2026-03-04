"use client";
import { useState } from "react";
import type { LayoutEntry } from "./types";

export function AddTabButton({ layout, tableName, onAdded }: {
  layout: LayoutEntry[]; tableName: string;
  onAdded: (entry: LayoutEntry) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const tabKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const maxSort = layout
      .filter(l => l.layout_type === "tab" && l.table_name === tableName)
      .reduce((max, l) => Math.max(max, l.sort_order), -1);

    try {
      const res = await fetch("/api/form_layout?table=form_layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _table: "form_layout",
          domain: "*",
          form_key: layout[0]?.form_key || "",
          table_name: tableName,
          layout_type: "tab",
          layout_key: tabKey,
          parent_key: "",
          sort_order: maxSort + 10,
          properties: { label: label.trim() },
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onAdded(created);
        setAdding(false);
        setLabel("");
      }
    } catch {}
    setSaving(false);
  };

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="flex items-center px-3 py-2.5 text-sm font-medium whitespace-nowrap"
        style={{ color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer", opacity: 0.7 }}>
        + Tab
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Tab name"
        className="px-2 py-1 text-sm rounded"
        style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-primary)", width: 120 }}
        autoFocus onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setLabel(""); } }}
      />
      <button onClick={handleAdd} disabled={saving || !label.trim()}
        className="px-2 py-1 rounded text-xs font-medium"
        style={{ background: "var(--accent)", color: "#fff", opacity: saving || !label.trim() ? 0.5 : 1 }}>
        Add
      </button>
      <button onClick={() => { setAdding(false); setLabel(""); }}
        className="px-2 py-1 rounded text-xs font-medium"
        style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
        ✕
      </button>
    </div>
  );
}

/* ── Add Section button (Step 3) ── */
