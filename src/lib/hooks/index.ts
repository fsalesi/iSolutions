/**
 * Hook registry — merges product hooks with customer hooks.
 *
 * Product hooks: src/lib/hooks/<table>.ts  — ship with iSolutions
 * Customer hooks: src/lib/hooks/custom/<table>.ts  — customer-specific
 *
 * Both layers run in order: product first, then customer.
 * Either layer can throw ValidationError to reject the operation.
 */
import type { CrudHooks } from "./types";
export { ValidationError } from "./types";
export type { CrudHooks, HookContext } from "./types";

// ── Product hooks (add new tables here) ──
import usersHooks from "./users";
import formLayoutHooks from "./form_layout";

const productHooks: Record<string, CrudHooks> = {
  users: usersHooks,
  form_layout: formLayoutHooks,
};

// ── Customer hooks (add customer overrides here) ──
// import cusUsersHooks from "@/custom/hooks/users";
const customerHooks: Record<string, CrudHooks> = {
  // users: cusUsersHooks,
};

/**
 * Merge product + customer hooks into a single CrudHooks object.
 * Product hooks run first, then customer hooks.
 */
function mergeHooks(a?: CrudHooks, b?: CrudHooks): CrudHooks | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;

  return {
    beforeSave: (a.beforeSave || b.beforeSave) ? async (body, ctx) => {
      if (a.beforeSave) await a.beforeSave(body, ctx);
      if (b.beforeSave) await b.beforeSave(body, ctx);
    } : undefined,

    afterSave: (a.afterSave || b.afterSave) ? async (body, ctx) => {
      if (a.afterSave) await a.afterSave(body, ctx);
      if (b.afterSave) await b.afterSave(body, ctx);
    } : undefined,

    beforeDelete: (a.beforeDelete || b.beforeDelete) ? async (oid, ctx) => {
      if (a.beforeDelete) await a.beforeDelete(oid, ctx);
      if (b.beforeDelete) await b.beforeDelete(oid, ctx);
    } : undefined,

    transformRows: (a.transformRows || b.transformRows) ? async (rows, db) => {
      if (a.transformRows) rows = await a.transformRows(rows, db);
      if (b.transformRows) rows = await b.transformRows(rows, db);
      return rows;
    } : undefined,
  };
}

// Cache merged hooks per table
const mergedCache: Record<string, CrudHooks | undefined> = {};

/**
 * Get hooks for a table. Returns merged product + customer hooks, or undefined.
 */
export function getHooks(table: string): CrudHooks | undefined {
  if (table in mergedCache) return mergedCache[table];
  const merged = mergeHooks(productHooks[table], customerHooks[table]);
  mergedCache[table] = merged;
  return merged;
}
