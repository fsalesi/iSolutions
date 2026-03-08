"use client";

import { Icon } from "@/components/icons/Icon";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { ColumnDef } from "@/platform/core/ColumnDef";
import { ConditionRow } from "./FilterConditionRow";
import { collectIds, type ColType, type FilterGroup, type FilterTree, mkCondition, mkGroup, rc } from "./filter-types";

export function GroupNode({ group, columns, colTypes, depth, selection, onSelect, onChange, onRemove, onApply, defaultField }: {
  group: FilterGroup; columns: ColumnDef[]; colTypes: Record<string, ColType>; depth: number;
  selection: Set<string>; onSelect: (ids: string[], c: boolean) => void;
  onChange: (g: FilterGroup) => void; onRemove: (() => void) | null;
  onApply: (tree?: FilterTree) => void; defaultField: string;
}) {
  const color = rc(depth);
  const allIds = collectIds(group);
  const allSel = allIds.every(id => selection.has(id));
  const someSel = !allSel && allIds.some(id => selection.has(id));

  return (
    <div style={{ display: "flex", minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 44, marginRight: 6 }}>
        <input type="checkbox" checked={allSel}
          ref={el => { if (el) el.indeterminate = someSel; }}
          onChange={() => onSelect(allIds, !allSel)}
          style={{ width: 15, height: 15, marginBottom: 4, accentColor: "var(--accent)" }} />
        <button
          onClick={() => onChange({ ...group, logic: group.logic === "and" ? "or" : "and" })}
          style={{ background: color, color: "var(--accent-text)", padding: "3px 7px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1, marginBottom: 4 }}
          title={group.logic === "and" ? resolveClientText(tx("grid.advanced.switch_to_or", "Switch to OR")) : resolveClientText(tx("grid.advanced.switch_to_and", "Switch to AND"))}>
          {group.logic === "and" ? "AND" : "OR"}
        </button>
        <div style={{ width: 3, flex: 1, background: color, borderRadius: 2, minHeight: 6 }} />
        <button
          onClick={() => onChange({ ...group, children: [...group.children, mkCondition(defaultField, colTypes)] })}
          title={resolveClientText(tx("grid.advanced.add_condition", "Add condition"))}
          style={{ width: 18, height: 18, borderRadius: "50%", background: color, color: "var(--accent-text)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4, opacity: 0.7 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "0.7"; }}>
          <Icon name="plus" size={10} />
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {group.children.length === 0 && (
          <div style={{ padding: "12px 0", fontSize: 12, color: "var(--text-muted)" }}>{resolveClientText(tx("grid.advanced.empty_group", "Empty group"))}</div>
        )}
        {group.children.map((child, idx) => (
          <div key={child.id}>
            {idx > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color, padding: "2px 0 2px 20px", letterSpacing: "0.05em" }}>
                {group.logic === "and" ? "AND" : "OR"}
              </div>
            )}
            {child.type === "condition" ? (
              <ConditionRow cond={child} columns={columns} colTypes={colTypes}
                selected={selection.has(child.id)}
                onToggle={() => onSelect([child.id], !selection.has(child.id))}
                onUpdate={p => { const c = [...group.children]; c[idx] = { ...child, ...p }; onChange({ ...group, children: c }); }}
                onRemove={() => onChange({ ...group, children: group.children.filter((_, j) => j !== idx) })}
                onApply={onApply} />
            ) : (
              <div style={{ paddingTop: 4, paddingBottom: 4 }}>
                <GroupNode group={child} columns={columns} colTypes={colTypes} depth={depth + 1}
                  selection={selection} onSelect={onSelect}
                  onChange={u => { const c = [...group.children]; c[idx] = u; onChange({ ...group, children: c }); }}
                  onRemove={() => onChange({ ...group, children: group.children.filter((_, j) => j !== idx) })}
                  onApply={onApply} defaultField={defaultField} />
              </div>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: 6, paddingTop: 4, paddingBottom: 2, flexWrap: "wrap" }}>
          <button onClick={() => onChange({ ...group, children: [...group.children, mkGroup("and", defaultField, colTypes)] })}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}>
            {resolveClientText(tx("grid.advanced.add_and", "+ AND"))}
          </button>
          <button onClick={() => onChange({ ...group, children: [...group.children, mkGroup("or", defaultField, colTypes)] })}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", color: "var(--text-muted)", background: "none", cursor: "pointer" }}>
            {resolveClientText(tx("grid.advanced.add_or", "+ OR"))}
          </button>
          {onRemove && (
            <button onClick={onRemove}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none", color: "var(--text-muted)", background: "none", cursor: "pointer", marginLeft: "auto" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--danger-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
              {resolveClientText(tx("grid.advanced.remove_group", "Remove group"))}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
