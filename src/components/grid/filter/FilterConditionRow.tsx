"use client";

import { Icon } from "@/components/icons/Icon";
import type { ColumnDef } from "@/platform/core/ColumnDef";
import type { FilterCondition, ColType, FilterOperator } from "./filter-types";
import { opsForType, inputTypeFor, SEL } from "./filter-types";

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

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", flexWrap: "wrap" }}>
      <input type="checkbox" checked={selected} onChange={onToggle}
        style={{ width: 15, height: 15, flexShrink: 0, accentColor: "var(--accent)" }} />
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
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>and</span>
        <input type={itype} value={cond.value2} onChange={e => onUpdate({ value2: e.target.value })}
          placeholder={ct === "number" ? "Max" : "To"} style={{ ...SEL, flex: "1 1 80px", maxWidth: 130 }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      </>)}
      {opDef && opDef.inputs === "list" && (
        <input type="text" value={cond.value} onChange={e => onUpdate({ value: e.target.value })}
          placeholder="val1, val2, val3…" style={{ ...SEL, flex: "1 1 140px" }}
          onKeyDown={e => e.key === "Enter" && onApply()} />
      )}
      <button onClick={onRemove} style={{ padding: 4, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
