"use client";
import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";

const COLUMN_COUNT_OPTIONS = [
  { value: "1", label: "1 column" },
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "4", label: "4 columns" },
];
import type { LayoutEntry } from "./types";

export function AddSectionButton({ tabKey, tableName, layout, onAdded }: {
  tabKey: string; tableName: string; layout: LayoutEntry[];
  onAdded: (entry: LayoutEntry) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [columns, setColumns] = useState(2);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const sectionKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const maxSort = layout
      .filter(l => l.layout_type === "section" && l.parent_key === tabKey && l.table_name === tableName)
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
          layout_type: "section",
          layout_key: sectionKey,
          parent_key: tabKey,
          sort_order: maxSort + 10,
          properties: { label: label.trim(), columns },
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onAdded(created);
        setAdding(false);
        setLabel("");
        setColumns(2);
      }
    } catch {}
    setSaving(false);
  };

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)}
        className="mt-4 px-4 py-2 rounded-lg text-sm font-medium w-full"
        style={{ border: "2px dashed var(--accent)", color: "var(--accent)", background: "transparent", cursor: "pointer" }}>
        + Add Section
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg" style={{ border: "2px dashed var(--accent)", background: "var(--bg-surface)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Section Name">
          <Input value={label} onChange={setLabel} />
        </Field>
        <Field label="Columns">
          <Select value={String(columns)} onChange={v => setColumns(parseInt(v) || 2)}
            options={COLUMN_COUNT_OPTIONS} />
        </Field>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => { setAdding(false); setLabel(""); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--bg-muted)", color: "var(--text-primary)" }}>
            Cancel
          </button>
          <button onClick={handleAdd} disabled={saving || !label.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: "var(--accent)", color: "#fff", opacity: saving || !label.trim() ? 0.5 : 1 }}>
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

