import type { ColumnDef } from "../datagrid/types";

// ── Types ──
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

export type SavedFilter = {
  id: number; name: string; filters_json: any; is_default: boolean; updated_at: string;
};

// ── Operators by type ──
export type OpDef = { value: FilterOperator; label: string; inputs: 0 | 1 | 2 | "list" };

export const TEXT_OPS: OpDef[] = [
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
export const NUMBER_OPS: OpDef[] = [
  { value: "eq",  label: "Equal To",  inputs: 1 }, { value: "neq", label: "Not Equal", inputs: 1 },
  { value: "gt",  label: "Greater Than", inputs: 1 }, { value: "gte", label: "Greater or Equal", inputs: 1 },
  { value: "lt",  label: "Less Than", inputs: 1 }, { value: "lte", label: "Less or Equal", inputs: 1 },
  { value: "between", label: "Between", inputs: 2 },
  { value: "in_list", label: "In List", inputs: "list" },
  { value: "is_empty", label: "Is Empty", inputs: 0 }, { value: "is_not_empty", label: "Is Not Empty", inputs: 0 },
];
export const DATE_OPS: OpDef[] = [
  { value: "eq",  label: "On",  inputs: 1 }, { value: "neq", label: "Not On", inputs: 1 },
  { value: "gt",  label: "After", inputs: 1 }, { value: "gte", label: "On or After", inputs: 1 },
  { value: "lt",  label: "Before", inputs: 1 }, { value: "lte", label: "On or Before", inputs: 1 },
  { value: "between", label: "Between", inputs: 2 },
  { value: "is_empty", label: "Is Empty", inputs: 0 }, { value: "is_not_empty", label: "Is Not Empty", inputs: 0 },
];
export const BOOL_OPS: OpDef[] = [
  { value: "is_true", label: "Is True", inputs: 0 },
  { value: "is_false", label: "Is False", inputs: 0 },
];

export function opsForType(t: ColType): OpDef[] {
  switch (t) { case "number": return NUMBER_OPS; case "date": case "datetime": return DATE_OPS; case "boolean": return BOOL_OPS; default: return TEXT_OPS; }
}
export function inputTypeFor(t: ColType): string {
  if (t === "date" || t === "datetime") return "date"; if (t === "number") return "number"; return "text";
}
export function findOp(op: FilterOperator): OpDef | undefined {
  for (const l of [TEXT_OPS, NUMBER_OPS, DATE_OPS, BOOL_OPS]) { const f = l.find(o => o.value === op); if (f) return f; } return undefined;
}

// ── Helpers ──
let _nextId = 1;
export const uid = () => `f${_nextId++}`;

export function mkCondition(field: string, colTypes: Record<string, ColType>): FilterCondition {
  const ops = opsForType(colTypes[field] || "text");
  return { type: "condition", id: uid(), field, operator: ops[0].value, value: "", value2: "" };
}
export function mkGroup(logic: "and" | "or", field: string, colTypes: Record<string, ColType>): FilterGroup {
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

export function cleanTree(node: FilterNode): FilterNode | null {
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

export function collectIds(node: FilterNode): string[] {
  if (node.type === "condition") return [node.id];
  return [node.id, ...node.children.flatMap(collectIds)];
}

export function serializeFilters(tree: FilterTree): string {
  if (!tree || tree.children.length === 0) return "";
  return JSON.stringify(tree);
}

export const RAIL = ["var(--accent)", "#f59e0b", "#8b5cf6", "#10b981", "#ef4444", "#ec4899"];
export const rc = (d: number) => RAIL[d % RAIL.length];
export const SEL: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, padding: "5px 8px", borderRadius: 4, minWidth: 0 };
