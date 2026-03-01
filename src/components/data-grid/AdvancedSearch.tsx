"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { ColumnDef } from "./DataGrid";

// ── Types ─────────────────────────────────────────────────────────
export type ColType = "text" | "number" | "boolean" | "date" | "datetime";

export type FilterOperator =
  | "eq" | "neq" | "contains" | "not_contains" | "begins" | "ends"
  | "gt" | "gte" | "lt" | "lte"
  | "is_empty" | "is_not_empty"
  | "in_list" | "not_in_list"
  | "between"
  | "is_true" | "is_false";

export type FilterCondition = {
  type: "condition"; id: string;
  field: string; operator: FilterOperator; value: string; value2: string;
};
export type FilterGroup = {
  type: "group"; id: string;
  logic: "and" | "or"; children: FilterNode[];
};
export type FilterNode = FilterCondition | FilterGroup;
export type FilterTree = FilterGroup | null;

type SavedFilter = {
  id: number; name: string; filters_json: any; is_default: boolean; updated_at: string;
};

// ── Operators by type ─────────────────────────────────────────────
type OpDef = { value: FilterOperator; label: string; inputs: 0 | 1 | 2 | "list" };

const TEXT_OPS: OpDef[] = [
  { value: "contains",     label: "Contains",         inputs: 1 },
  { value: "not_contains", label: "Doesn't Contain",  inputs: 1 },
  { value: "eq",           label: "Equal To",         inputs: 1 },
  { value: "neq",          label: "Not Equal",        inputs: 1 },
  { value: "begins",       label: "Begins With",      inputs: 1 },
  { value: "ends",         label: "Ends With",        inputs: 1 },
  { value: "in_list",      label: "In List",          inputs: "list" },
  { value: "not_in_list",  label: "Not In List",      inputs: "list" },
  { value: "is_empty",     label: "Is Empty",         inputs: 0 },
  { value: "is_not_empty", label: "Is Not Empty",     inputs: 0 },
];
const NUMBER_OPS: OpDef[] = [
  { value: "eq",  label: "Equal To",  inputs: 1 }, { value: "neq", label: "Not Equal", inputs: 1 },
  { value: "gt",  label: "Greater Than", inputs: 1 }, { value: "gte", label: "Greater or Equal", inputs: 1 },
  { value: "lt",  label: "Less Than", inputs: 1 }, { value: "lte", label: "Less or Equal", inputs: 1 },
  { value: "between", label: "Between", inputs: 2 },
  { value: "in_list", label: "In List", inputs: "list" },
  { value: "is_empty", label: "Is Empty", inputs: 0 }, { value: "is_not_empty", label: "Is Not Empty", inputs: 0 },
];
const DATE_OPS: OpDef[] = [
  { value: "eq",  label: "On",  inputs: 1 }, { value: "neq", label: "Not On", inputs: 1 },
  { value: "gt",  label: "After", inputs: 1 }, { value: "gte", label: "On or After", inputs: 1 },
  { value: "lt",  label: "Before", inputs: 1 }, { value: "lte", label: "On or Before", inputs: 1 },
  { value: "between", label: "Between", inputs: 2 },
  { value: "is_empty", label: "Is Empty", inputs: 0 }, { value: "is_not_empty", label: "Is Not Empty", inputs: 0 },
];
const BOOL_OPS: OpDef[] = [
  { value: "is_true", label: "Is True", inputs: 0 },
  { value: "is_false", label: "Is False", inputs: 0 },
];

function opsForType(t: ColType): OpDef[] {
  switch (t) { case "number": return NUMBER_OPS; case "date": case "datetime": return DATE_OPS; case "boolean": return BOOL_OPS; default: return TEXT_OPS; }
}
function inputTypeFor(t: ColType): string {
  if (t === "date" || t === "datetime") return "date"; if (t === "number") return "number"; return "text";
}
function findOp(op: FilterOperator): OpDef | undefined {
  for (const l of [TEXT_OPS, NUMBER_OPS, DATE_OPS, BOOL_OPS]) { const f = l.find(o => o.value === op); if (f) return f; } return undefined;
}

// ── Helpers ───────────────────────────────────────────────────────
let _nextId = 1;
const uid = () => `f${_nextId++}`;
function mkCondition(field: string, colTypes: Record<string, ColType>): FilterCondition {
  const ops = opsForType(colTypes[field] || "text");
  return { type: "condition", id: uid(), field, operator: ops[0].value, value: "", value2: "" };
}
function mkGroup(logic: "and" | "or", field: string, colTypes: Record<string, ColType>): FilterGroup {
  return { type: "group", id: uid(), logic, children: [mkCondition(field, colTypes)] };
}

export function countConditions(node: FilterNode | null): number {
  if (!node) return 0;
  if (node.type === "condition") {
    const op = findOp(node.operator);
    if (!op) return 0;
    if (op.inputs === 0) return 1;
    if (op.inputs === 2) return (node.value.trim() && node.value2.trim()) ? 1 : 0;
    return node.value.trim() ? 1 : 0;
  }
  return node.children.reduce((n, c) => n + countConditions(c), 0);
}

function cleanTree(node: FilterNode): FilterNode | null {
  if (node.type === "condition") {
    const op = findOp(node.operator);
    if (!op) return null;
    if (op.inputs === 0) return node;
    if (op.inputs === 2) return (node.value.trim() && node.value2.trim()) ? node : null;
    return node.value.trim() ? node : null;
  }
  const ch = node.children.map(cleanTree).filter(Boolean) as FilterNode[];
  return ch.length ? { ...node, children: ch } : null;
}

function collectIds(node: FilterNode): string[] {
  if (node.type === "condition") return [node.id];
  return [node.id, ...node.children.flatMap(collectIds)];
}

const RAIL = ["var(--accent)", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#ec4899"];
const rc = (d: number) => RAIL[d % RAIL.length];
const SEL: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, padding: "5px 8px", borderRadius: 4, minWidth: 0 };

// ── Inline Confirm Dialog ─────────────────────────────────────────
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

// ── Inline Save Name Input ────────────────────────────────────────
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

// ── Condition Row ─────────────────────────────────────────────────
function ConditionRow({ cond, columns, colTypes, selected, onToggle, onUpdate, onRemove, onApply }: {
  cond: FilterCondition; columns: ColumnDef<any>[]; colTypes: Record<string, ColType>;
  selected: boolean; onToggle: () => void;
  onUpdate: (p: Partial<FilterCondition>) => void; onRemove: () => void; onApply: () => void;
}) {
  const t = useT();
  const ct = colTypes[cond.field] || "text";
  const ops = opsForType(ct);
  const opDef = ops.find(o => o.value === cond.operator);
  const itype = inputTypeFor(ct);

  const handleFieldChange = (nf: string) => {
    const nt = colTypes[nf] || "text";
    const no = opsForType(nt);
    const keep = no.some(o => o.value === cond.operator);
    onUpdate({ field: nf, operator: keep ? cond.operator : no[0].value, value: "", value2: "" });
  };

  return (
    <div className="flex items-center gap-2 py-1.5 flex-wrap sm:flex-nowrap">
      <input type="checkbox" checked={selected} onChange={onToggle}
        className="accent-[var(--accent)] flex-shrink-0" style={{ width: 15, height: 15 }} />
      <select value={cond.field} onChange={e => handleFieldChange(e.target.value)}
        style={{ ...SEL, flex: "1 1 130px", maxWidth: 170 }}>
        {columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <select value={cond.operator} onChange={e => onUpdate({ operator: e.target.value as FilterOperator, value: "", value2: "" })}
        style={{ ...SEL, flex: "1 1 110px", maxWidth: 155 }}>
        {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {opDef && opDef.inputs === 1 && (
        <input type={itype} value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder={ct === "date" || ct === "datetime" ? "" : "Value…"}
          style={{ ...SEL, flex: "1 1 100px" }} onKeyDown={e => e.key === "Enter" && onApply()} />
      )}
      {opDef && opDef.inputs === 2 && (<>
        <input type={itype} value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder={ct === "number" ? "Min" : "From"} style={{ ...SEL, flex: "1 1 80px", maxWidth: 130 }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
        <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>and</span>
        <input type={itype} value={cond.value2} onChange={e => onUpdate({ value2: e.target.value })}
          placeholder={ct === "number" ? "Max" : "To"} style={{ ...SEL, flex: "1 1 80px", maxWidth: 130 }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      </>)}
      {opDef && opDef.inputs === "list" && (
        <input type="text" value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder="val1, val2, val3…" style={{ ...SEL, flex: "1 1 140px" }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      )}
      <button onClick={onRemove} className="p-1 rounded flex-shrink-0 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

// ── Group Node ────────────────────────────────────────────────────
function GroupNode({ group, columns, colTypes, depth, selection, onSelect, onChange, onRemove, onApply, defaultField }: {
  group: FilterGroup; columns: ColumnDef<any>[]; colTypes: Record<string, ColType>; depth: number;
  selection: Set<string>; onSelect: (ids: string[], c: boolean) => void;
  onChange: (g: FilterGroup) => void; onRemove: (() => void) | null;
  onApply: (tree?: FilterTree) => void; defaultField: string;
}) {
  const t = useT();
  const color = rc(depth);
  const allIds = collectIds(group);
  const allSel = allIds.every(id => selection.has(id));
  const someSel = !allSel && allIds.some(id => selection.has(id));

  return (
    <div className="flex" style={{ minHeight: 0 }}>
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 44, marginRight: 6 }}>
        <input type="checkbox" checked={allSel}
          ref={el => { if (el) el.indeterminate = someSel; }}
          onChange={() => onSelect(allIds, !allSel)}
          className="accent-[var(--accent)] mb-1" style={{ width: 15, height: 15 }} />
        <button onClick={() => onChange({ ...group, logic: group.logic === "and" ? "or" : "and" })}
          className="rounded text-[10px] font-bold uppercase tracking-wider leading-none mb-1"
          style={{ background: color, color: "#fff", padding: "3px 7px", border: "none", cursor: "pointer" }}
          title={`Switch to ${group.logic === "and" ? "OR" : "AND"}`}>{group.logic}</button>
        <div style={{ width: 3, flex: 1, background: color, borderRadius: 2, minHeight: 6 }} />
        <button onClick={() => onChange({ ...group, children: [...group.children, mkCondition(defaultField, colTypes)] })}
          title={t("filter.add_condition", "Add condition")}
          className="rounded-full flex items-center justify-center mt-1 opacity-60 hover:opacity-100 transition-opacity"
          style={{ width: 18, height: 18, background: color, color: "#fff" }}>
          <Icon name="plus" size={10} />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        {group.children.length === 0 && <div className="py-3 text-xs" style={{ color: "var(--text-muted)" }}>Empty group</div>}
        {group.children.map((child, idx) => (
          <div key={child.id}>
            {idx > 0 && <div className="text-[10px] font-bold uppercase py-0.5" style={{ color, letterSpacing: "0.05em", paddingLeft: 20 }}>{group.logic}</div>}
            {child.type === "condition" ? (
              <ConditionRow cond={child} columns={columns} colTypes={colTypes}
                selected={selection.has(child.id)}
                onToggle={() => onSelect([child.id], !selection.has(child.id))}
                onUpdate={p => { const c = [...group.children]; c[idx] = { ...child, ...p }; onChange({ ...group, children: c }); }}
                onRemove={() => onChange({ ...group, children: group.children.filter((_, j) => j !== idx) })}
                onApply={onApply} />
            ) : (
              <div className="py-1">
                <GroupNode group={child} columns={columns} colTypes={colTypes} depth={depth + 1}
                  selection={selection} onSelect={onSelect}
                  onChange={u => { const c = [...group.children]; c[idx] = u; onChange({ ...group, children: c }); }}
                  onRemove={() => onChange({ ...group, children: group.children.filter((_, j) => j !== idx) })}
                  onApply={onApply} defaultField={defaultField} />
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2 pt-1 pb-0.5 flex-wrap">
          <button onClick={() => onChange({ ...group, children: [...group.children, mkGroup("and", defaultField, colTypes)] })}
            className="text-[11px] px-2 py-0.5 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>+ AND</button>
          <button onClick={() => onChange({ ...group, children: [...group.children, mkGroup("or", defaultField, colTypes)] })}
            className="text-[11px] px-2 py-0.5 rounded" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>+ OR</button>
          {onRemove && (
            <button onClick={onRemove} className="text-[11px] px-2 py-0.5 rounded ml-auto" style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>Remove group</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tree manipulation ─────────────────────────────────────────────
function findLocation(root: FilterGroup, tid: string): { parent: FilterGroup; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === tid) return { parent: root, index: i };
    const ch = root.children[i]; if (ch.type === "group") { const f = findLocation(ch, tid); if (f) return f; }
  }
  return null;
}
function removeNodes(root: FilterGroup, ids: Set<string>): FilterGroup {
  return { ...root, children: root.children.filter(c => !ids.has(c.id)).map(c => c.type === "group" ? removeNodes(c, ids) : c) };
}
function extractNodes(root: FilterGroup, ids: Set<string>): FilterNode[] {
  const r: FilterNode[] = [];
  (function w(g: FilterGroup) { for (const c of g.children) { if (ids.has(c.id)) r.push(c); else if (c.type === "group") w(c); } })(root);
  return r;
}
function groupSelected(root: FilterGroup, ids: Set<string>, logic: "and" | "or"): FilterGroup {
  const ext = extractNodes(root, ids); if (!ext.length) return root;
  let pid: string | null = null, pi = 0;
  (function f(g: FilterGroup): boolean { for (let i = 0; i < g.children.length; i++) { if (g.children[i].id === ext[0].id) { pid = g.id; pi = i; return true; } if (g.children[i].type === "group" && f(g.children[i] as FilterGroup)) return true; } return false; })(root);
  let nr = removeNodes(root, ids);
  const w: FilterGroup = { type: "group", id: uid(), logic, children: ext };
  function ins(g: FilterGroup): FilterGroup { if (g.id === pid) { const c = [...g.children]; c.splice(Math.min(pi, c.length), 0, w); return { ...g, children: c }; } return { ...g, children: g.children.map(ch => ch.type === "group" ? ins(ch) : ch) }; }
  return pid ? ins(nr) : { ...nr, children: [...nr.children, w] };
}
function ungroupNode(root: FilterGroup, gid: string): FilterGroup {
  function p(g: FilterGroup): FilterGroup { const nc: FilterNode[] = []; for (const c of g.children) { if (c.id === gid && c.type === "group") nc.push(...c.children); else nc.push(c.type === "group" ? p(c) : c); } return { ...g, children: nc }; }
  return p(root);
}
function moveNode(root: FilterGroup, nid: string, dir: -1 | 1): FilterGroup {
  function p(g: FilterGroup): FilterGroup { const i = g.children.findIndex(c => c.id === nid); if (i !== -1) { const j = i + dir; if (j < 0 || j >= g.children.length) return g; const c = [...g.children]; [c[i], c[j]] = [c[j], c[i]]; return { ...g, children: c }; } return { ...g, children: g.children.map(ch => ch.type === "group" ? p(ch) : ch) }; }
  return p(root);
}

// ── Modal ─────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return createPortal(
    <div ref={ref} onClick={e => e.target === ref.current && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
      <div style={{ background: "var(--bg-surface)", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "0 25px 50px -12px rgba(0,0,0,.25)",
        width: "min(800px, calc(100vw - 32px))", maxHeight: "calc(100vh - 64px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>, document.body
  );
}

// ── Saved Filters Bar ─────────────────────────────────────────────
function SavedFiltersBar({ saved, activeName, onLoad, onSave, onSaveAs, onDelete, onSetDefault }: {
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

      {/* Dropdown */}
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

      {/* Save / Save As */}
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

// ── Main ──────────────────────────────────────────────────────────
interface AdvancedSearchProps {
  columns: ColumnDef<any>[];
  colTypes: Record<string, ColType>;
  filters: FilterTree;
  onChange: (f: FilterTree) => void;
  onApply: (tree?: FilterTree) => void;
  onClose: () => void;
  gridId?: string;
  userId?: string;
}

export function AdvancedSearch({ columns, colTypes, filters, onChange, onApply, onClose, gridId, userId }: AdvancedSearchProps) {
  const t = useT();
  const df = columns[0]?.key || "";
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const activeCount = filters ? countConditions(filters) : 0;
  const selCount = selection.size;

  // ── Saved filters ──
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [activeName, setActiveName] = useState("");
  const canSave = !!(gridId && userId);

  const fetchSaved = useCallback(() => {
    if (!canSave) return;
    fetch(`/api/saved-filters?userId=${userId}&gridId=${gridId}`)
      .then(r => r.json()).then(setSaved).catch(() => {});
  }, [canSave, userId, gridId]);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  const defaultLoaded = useRef(false);
  useEffect(() => {
    if (defaultLoaded.current || !saved.length) return;
    const def = saved.find(s => s.is_default);
    if (def && !filters) {
      onChange(def.filters_json);
      setActiveName(def.name);
      defaultLoaded.current = true;
    }
  }, [saved, filters, onChange]);

  const handleLoad = (s: SavedFilter) => { onChange(s.filters_json); setActiveName(s.name); setSelection(new Set()); };

  const handleSave = async (s: SavedFilter) => {
    if (!canSave || !filters) return;
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name: s.name, filtersJson: filters, isDefault: s.is_default, id: s.id }) });
    fetchSaved();
  };

  const handleSaveAs = async (name: string) => {
    if (!canSave || !filters) return;
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name, filtersJson: filters, isDefault: false }) });
    setActiveName(name);
    fetchSaved();
  };

  const handleDelete = async (s: SavedFilter) => {
    await fetch(`/api/saved-filters?id=${s.id}&userId=${userId}`, { method: "DELETE" });
    if (activeName === s.name) setActiveName("");
    fetchSaved();
  };

  const handleSetDefault = async (s: SavedFilter) => {
    await fetch("/api/saved-filters", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, gridId, name: s.name, filtersJson: s.filters_json, isDefault: !s.is_default, id: s.id }) });
    fetchSaved();
  };

  // ── Selection & toolbar ──
  const handleSelect = useCallback((ids: string[], checked: boolean) => {
    setSelection(prev => { const n = new Set(prev); ids.forEach(id => checked ? n.add(id) : n.delete(id)); return n; });
  }, []);

  const handleApply = () => { const cleaned = filters ? cleanTree(filters) as FilterGroup | null : null; onChange(cleaned); onApply(cleaned); };
  const clearAll = () => { onChange(null); setSelection(new Set()); setActiveName(""); onApply(null); };

  const doGroup = (logic: "and" | "or") => { if (filters && selCount >= 2) { onChange(groupSelected(filters, selection, logic)); setSelection(new Set()); } };
  const doUngroup = () => {
    if (!filters) return; let r = filters;
    for (const id of selection) { const l = findLocation(r, id); if (l) { const n = l.parent.children[l.index]; if (n.type === "group") r = ungroupNode(r, id); } }
    onChange(r); setSelection(new Set());
  };
  const doDelete = () => { if (!filters) return; const nr = removeNodes(filters, selection); onChange(nr.children.length === 0 ? null : nr); setSelection(new Set()); };
  const doMove = (dir: -1 | 1) => { if (filters && selCount === 1) onChange(moveNode(filters, [...selection][0], dir)); };

  const hasSelGroups = filters ? [...selection].some(id => {
    function f(g: FilterGroup): boolean { for (const c of g.children) { if (c.id === id && c.type === "group") return true; if (c.type === "group" && f(c)) return true; } return false; }
    return f(filters);
  }) : false;

  const tbtn = (label: string, icon: string, onClick: () => void, disabled: boolean, danger?: boolean) => (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30"
      style={{ border: "1px solid var(--border)", color: danger ? "#ef4444" : "var(--text-primary)", background: "var(--bg-surface)" }}>
      <Icon name={icon} size={13} />{label}
    </button>
  );

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <Icon name="filter" size={18} />
          <span className="font-semibold" style={{ color: "var(--text-primary)", fontSize: 15 }}>Advanced Search</span>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
              {activeCount} filter{activeCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* Saved Filters */}
      {canSave && (
        <SavedFiltersBar saved={saved} activeName={activeName}
          onLoad={handleLoad} onSave={handleSave} onSaveAs={handleSaveAs}
          onDelete={handleDelete} onSetDefault={handleSetDefault} />
      )}

      {/* Toolbar */}
      {filters && (
        <div className="flex items-center gap-2 px-5 py-2 flex-wrap" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface-alt)" }}>
          {tbtn(t("filter.group_and", "Group AND"), "plus", () => doGroup("and"), selCount < 2)}
          {tbtn(t("filter.group_or", "Group OR"), "plus", () => doGroup("or"), selCount < 2)}
          {tbtn(t("filter.ungroup", "Ungroup"), "expand", doUngroup, !hasSelGroups)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn("↑", "chevUp", () => doMove(-1), selCount !== 1)}
          {tbtn("↓", "chevDown", () => doMove(1), selCount !== 1)}
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
          {tbtn("Delete", "trash", doDelete, selCount === 0, true)}
          {selCount > 0 && <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>{selCount} selected</span>}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 120 }}>
        {!filters ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm mb-4">No search filters defined</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => onChange(mkGroup("and", df, colTypes))}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>+ AND Group</button>
              <button onClick={() => onChange(mkGroup("or", df, colTypes))}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#f59e0b", color: "#fff" }}>+ OR Group</button>
            </div>
          </div>
        ) : (
          <GroupNode group={filters} columns={columns} colTypes={colTypes} depth={0}
            selection={selection} onSelect={handleSelect}
            onChange={u => onChange(u)} onRemove={null} onApply={handleApply} defaultField={df} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div>{activeCount > 0 && (
          <button onClick={clearAll} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>Clear All</button>
        )}</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-surface)" }}>Close</button>
          <button onClick={handleApply} className="px-5 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--accent)", color: "#fff" }}>Show Results</button>
        </div>
      </div>
    </Modal>
  );
}

export function serializeFilters(tree: FilterTree): string {
  if (!tree || tree.children.length === 0) return "";
  return JSON.stringify(tree);
}
