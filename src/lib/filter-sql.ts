/**
 * Shared SQL filter builder for advanced search.
 * Used by all API routes that support the nested AND/OR filter tree.
 */

type ColType = "text" | "number" | "boolean" | "date" | "datetime" | "image";

type FilterCondition = {
  type: "condition"; field: string; operator: string; value: string; value2?: string;
};
type FilterGroup = {
  type: "group"; logic: "and" | "or"; children: FilterNode[];
};
type FilterNode = FilterCondition | FilterGroup;

type SQLResult = { sql: string; params: any[]; nextIdx: number } | null;

export function buildFilterWhere(
  json: string,
  startIdx: number,
  colTypes: Record<string, ColType>,
  allowedColumns: Set<string>
): { sql: string; params: any[]; nextIdx: number } {
  let tree: FilterNode;
  try { tree = JSON.parse(json); } catch { return { sql: "", params: [], nextIdx: startIdx }; }
  if (!tree || (tree.type === "group" && (!tree.children || !tree.children.length)))
    return { sql: "", params: [], nextIdx: startIdx };

  const colType = (f: string): ColType => colTypes[f] || "text";
  const castCol = (f: string): string => {
    if (!allowedColumns.has(f)) return `"${f}"`;
    const t = colType(f);
    if (t === "number") return `"${f}"::numeric`;
    return `"${f}"`;
  };

  function buildCondition(cond: FilterCondition, idx: number): SQLResult {
    if (!allowedColumns.has(cond.field)) return null;
    const col = castCol(cond.field);
    const t = colType(cond.field);
    const p = `$${idx}`;

    switch (cond.operator) {
      case "eq":
        if (t === "date" || t === "datetime") return { sql: `${col}::date = ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} = ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "boolean") return { sql: `${col} = ${p}::boolean`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} = ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "neq":
        if (t === "date" || t === "datetime") return { sql: `${col}::date != ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} != ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "boolean") return { sql: `${col} != ${p}::boolean`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} != ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "contains":     return { sql: `${col}::text ILIKE ${p}`, params: [`%${cond.value}%`], nextIdx: idx + 1 };
      case "not_contains": return { sql: `${col}::text NOT ILIKE ${p}`, params: [`%${cond.value}%`], nextIdx: idx + 1 };
      case "begins":       return { sql: `${col}::text ILIKE ${p}`, params: [`${cond.value}%`], nextIdx: idx + 1 };
      case "ends":         return { sql: `${col}::text ILIKE ${p}`, params: [`%${cond.value}`], nextIdx: idx + 1 };
      case "gt":
        if (t === "date" || t === "datetime") return { sql: `${col}::date > ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} > ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} > ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "gte":
        if (t === "date" || t === "datetime") return { sql: `${col}::date >= ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} >= ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} >= ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "lt":
        if (t === "date" || t === "datetime") return { sql: `${col}::date < ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} < ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} < ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "lte":
        if (t === "date" || t === "datetime") return { sql: `${col}::date <= ${p}::date`, params: [cond.value], nextIdx: idx + 1 };
        if (t === "number") return { sql: `${col} <= ${p}::numeric`, params: [cond.value], nextIdx: idx + 1 };
        return { sql: `${col} <= ${p}`, params: [cond.value], nextIdx: idx + 1 };
      case "between": {
        const v2 = cond.value2 || "";
        if (!cond.value || !v2) return null;
        const p2 = `$${idx + 1}`;
        if (t === "date" || t === "datetime") return { sql: `${col}::date BETWEEN ${p}::date AND ${p2}::date`, params: [cond.value, v2], nextIdx: idx + 2 };
        if (t === "number") return { sql: `${col} BETWEEN ${p}::numeric AND ${p2}::numeric`, params: [cond.value, v2], nextIdx: idx + 2 };
        return { sql: `${col} BETWEEN ${p} AND ${p2}`, params: [cond.value, v2], nextIdx: idx + 2 };
      }
      case "is_empty":     return { sql: `("${cond.field}" IS NULL OR "${cond.field}"::text = '')`, params: [], nextIdx: idx };
      case "is_not_empty": return { sql: `("${cond.field}" IS NOT NULL AND "${cond.field}"::text != '')`, params: [], nextIdx: idx };
      case "in_list": {
        const vals = cond.value.split(",").map(v => v.trim()).filter(Boolean);
        if (!vals.length) return null;
        const phs = vals.map((_, i) => `$${idx + i}`);
        return { sql: `${col}::text IN (${phs.join(", ")})`, params: vals, nextIdx: idx + vals.length };
      }
      case "not_in_list": {
        const vals = cond.value.split(",").map(v => v.trim()).filter(Boolean);
        if (!vals.length) return null;
        const phs = vals.map((_, i) => `$${idx + i}`);
        return { sql: `${col}::text NOT IN (${phs.join(", ")})`, params: vals, nextIdx: idx + vals.length };
      }
      case "is_true":  return { sql: `"${cond.field}" = true`, params: [], nextIdx: idx };
      case "is_false": return { sql: `("${cond.field}" = false OR "${cond.field}" IS NULL)`, params: [], nextIdx: idx };
      default: return null;
    }
  }

  function buildNode(node: FilterNode, idx: number): SQLResult {
    if (node.type === "condition") return buildCondition(node, idx);
    const joiner = node.logic === "or" ? " OR " : " AND ";
    const parts: string[] = [];
    const allParams: any[] = [];
    let ci = idx;
    for (const child of node.children) {
      const r = buildNode(child, ci);
      if (!r) continue;
      parts.push(r.sql); allParams.push(...r.params); ci = r.nextIdx;
    }
    if (!parts.length) return null;
    return { sql: parts.length === 1 ? parts[0] : `(${parts.join(joiner)})`, params: allParams, nextIdx: ci };
  }

  return buildNode(tree, startIdx) || { sql: "", params: [], nextIdx: startIdx };
}

/**
 * Parse ?oid= query parameter into a SQL condition.
 * Every API GET route should call this to support deep links by OID.
 *
 * Usage in route.ts:
 *   const oidFilter = parseOidFilter(url, pi);
 *   if (oidFilter) { conditions.push(oidFilter.sql); params.push(...oidFilter.params); pi = oidFilter.nextIdx; }
 */
export function parseOidFilter(
  url: URL,
  startIdx: number
): { sql: string; params: any[]; nextIdx: number } | null {
  const oid = url.searchParams.get("oid")?.trim();
  if (!oid) return null;
  return {
    sql: `oid = $${startIdx}::uuid`,
    params: [oid],
    nextIdx: startIdx + 1,
  };
}
