import type { FilterGroup, FilterNode, FilterTree } from "./filter-types";
import { uid } from "./filter-types";

export function findLocation(root: FilterGroup, tid: string): { parent: FilterGroup; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === tid) return { parent: root, index: i };
    const ch = root.children[i]; if (ch.type === "group") { const f = findLocation(ch, tid); if (f) return f; }
  }
  return null;
}

export function removeNodes(root: FilterGroup, ids: Set<string>): FilterGroup {
  return { ...root, children: root.children.filter(c => !ids.has(c.id)).map(c => c.type === "group" ? removeNodes(c, ids) : c) };
}

export function extractNodes(root: FilterGroup, ids: Set<string>): FilterNode[] {
  const r: FilterNode[] = [];
  (function w(g: FilterGroup) { for (const c of g.children) { if (ids.has(c.id)) r.push(c); else if (c.type === "group") w(c); } })(root);
  return r;
}

export function groupSelected(root: FilterGroup, ids: Set<string>, logic: "and" | "or"): FilterGroup {
  const ext = extractNodes(root, ids); if (!ext.length) return root;
  let pid: string | null = null, pi = 0;
  (function f(g: FilterGroup): boolean { for (let i = 0; i < g.children.length; i++) { if (g.children[i].id === ext[0].id) { pid = g.id; pi = i; return true; } if (g.children[i].type === "group" && f(g.children[i] as FilterGroup)) return true; } return false; })(root);
  let nr = removeNodes(root, ids);
  const w: FilterGroup = { type: "group", id: uid(), logic, children: ext };
  function ins(g: FilterGroup): FilterGroup { if (g.id === pid) { const c = [...g.children]; c.splice(Math.min(pi, c.length), 0, w); return { ...g, children: c }; } return { ...g, children: g.children.map(ch => ch.type === "group" ? ins(ch) : ch) }; }
  return pid ? ins(nr) : { ...nr, children: [...nr.children, w] };
}

export function ungroupNode(root: FilterGroup, gid: string): FilterGroup {
  function p(g: FilterGroup): FilterGroup { const nc: FilterNode[] = []; for (const c of g.children) { if (c.id === gid && c.type === "group") nc.push(...c.children); else nc.push(c.type === "group" ? p(c) : c); } return { ...g, children: nc }; }
  return p(root);
}

export function moveNode(root: FilterGroup, nid: string, dir: -1 | 1): FilterGroup {
  function p(g: FilterGroup): FilterGroup { const i = g.children.findIndex(c => c.id === nid); if (i !== -1) { const j = i + dir; if (j < 0 || j >= g.children.length) return g; const c = [...g.children]; [c[i], c[j]] = [c[j], c[i]]; return { ...g, children: c }; } return { ...g, children: g.children.map(ch => ch.type === "group" ? p(ch) : ch) }; }
  return p(root);
}
