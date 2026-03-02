"use client";

import { Icon } from "@/components/icons/Icon";
import { useT } from "@/context/TranslationContext";
import type { ColumnDef } from "../datagrid/types";
import type { FilterGroup, FilterTree, ColType } from "./filter-types";
import { rc, mkCondition, mkGroup, collectIds } from "./filter-types";
import { ConditionRow } from "./FilterConditionRow";

export function GroupNode({ group, columns, colTypes, depth, selection, onSelect, onChange, onRemove, onApply, defaultField }: {
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
