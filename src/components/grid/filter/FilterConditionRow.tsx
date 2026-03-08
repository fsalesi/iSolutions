"use client";

import { Icon } from "@/components/icons/Icon";
import { resolveClientText } from "@/lib/i18n/runtime";
import { tx } from "@/lib/i18n/types";
import type { ColumnDef } from "@/platform/core/ColumnDef";
import { inputTypeFor, opsForType, SEL } from "./filter-types";
import type { ColType, FilterCondition, FilterOperator } from "./filter-types";

export function ConditionRow({ cond, columns, colTypes, selected, onToggle, onUpdate, onRemove, onApply }: {
  cond: FilterCondition; columns: ColumnDef[]; colTypes: Record<string, ColType>;
  selected: boolean; onToggle: () => void;
  onUpdate: (p: Partial<FilterCondition>) => void; onRemove: () => void; onApply: () => void;
}) {
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

  const opLabel = (op: { value: FilterOperator; label: string }) => {
    const keyMap: Record<string, string> = {
      contains: 'grid.filter.ops.contains',
      not_contains: 'grid.filter.ops.not_contains',
      eq: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.on' : 'grid.filter.ops.eq',
      neq: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.not_on' : 'grid.filter.ops.neq',
      begins: 'grid.filter.ops.begins',
      ends: 'grid.filter.ops.ends',
      in_list: 'grid.filter.ops.in_list',
      not_in_list: 'grid.filter.ops.not_in_list',
      is_empty: 'grid.filter.ops.is_empty',
      is_not_empty: 'grid.filter.ops.is_not_empty',
      gt: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.after' : 'grid.filter.ops.gt',
      gte: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.on_or_after' : 'grid.filter.ops.gte',
      lt: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.before' : 'grid.filter.ops.lt',
      lte: ct === 'date' || ct === 'datetime' ? 'grid.filter.ops.on_or_before' : 'grid.filter.ops.lte',
      between: 'grid.filter.ops.between',
      is_true: 'grid.filter.ops.is_true',
      is_false: 'grid.filter.ops.is_false',
    };
    return resolveClientText(tx(keyMap[op.value] || `grid.filter.ops.${op.value}`, op.label));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", flexWrap: "wrap" }}>
      <input type="checkbox" checked={selected} onChange={onToggle}
        style={{ width: 15, height: 15, flexShrink: 0, accentColor: "var(--accent)" }} />
      <select value={cond.field} onChange={e => handleFieldChange(e.target.value)}
        style={{ ...SEL, flex: "1 1 130px", maxWidth: 170 }}>
        {columns.map(c => <option key={c.key} value={c.key}>{c.getLabel()}</option>)}
      </select>
      <select value={cond.operator} onChange={e => onUpdate({ operator: e.target.value as FilterOperator, value: "", value2: "" })}
        style={{ ...SEL, flex: "1 1 110px", maxWidth: 155 }}>
        {ops.map(o => <option key={o.value} value={o.value}>{opLabel(o)}</option>)}
      </select>
      {opDef && opDef.inputs === 1 && (
        <input type={itype} value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder={ct === "date" || ct === "datetime" ? "" : resolveClientText(tx("grid.filter.value", "Value..."))}
          style={{ ...SEL, flex: "1 1 100px" }} onKeyDown={e => e.key === "Enter" && onApply()} />
      )}
      {opDef && opDef.inputs === 2 && (<>
        <input type={itype} value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder={resolveClientText(tx(ct === "number" ? "grid.filter.min" : "grid.filter.from", ct === "number" ? "Min" : "From"))} style={{ ...SEL, flex: "1 1 80px", maxWidth: 130 }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{resolveClientText(tx("grid.filter.and", "and"))}</span>
        <input type={itype} value={cond.value2} onChange={e => onUpdate({ value2: e.target.value })}
          placeholder={resolveClientText(tx(ct === "number" ? "grid.filter.max" : "grid.filter.to", ct === "number" ? "Max" : "To"))} style={{ ...SEL, flex: "1 1 80px", maxWidth: 130 }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      </>)}
      {opDef && opDef.inputs === "list" && (
        <input type="text" value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder={resolveClientText(tx("grid.filter.list_values", "val1, val2, val3..."))} style={{ ...SEL, flex: "1 1 140px" }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      )}
      <button onClick={onRemove} style={{ padding: 4, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--danger-text)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
