/**
 * Hook registry — merges product hooks with customer hooks.
 *
 * Product hooks: src/lib/hooks/<table>.ts  — ship with iSolutions
 * Customer hooks: custom/hooks/<table>.ts  — customer-specific, outside main code
 *
 * Both layers run in order: product first, then customer.
 * Either layer can throw ValidationError to reject the operation.
 */
import type { CrudHooks, HookContext } from "./types";
import path from "path";
import fs from "fs";
export { ValidationError } from "./types";
export type { CrudHooks, HookContext } from "./types";

// ── Product hooks (static imports — add new tables here) ──
import usersHooks from "./users";

const productHooks: Record<string, CrudHooks> = {
  users: usersHooks,
};

// ── Customer hooks (loaded once from custom/hooks/ at project root) ──
const customerHooks: Record<string, CrudHooks> = {};
let customerLoaded = false;

function loadCustomerHooks(): void {
  if (customerLoaded) return;
  customerLoaded = true;
  try {
    const customDir = path.join(process.cwd(), "custom", "hooks");
    if (!fs.existsSync(customDir)) return;
    const files = fs.readdirSync(customDir).filter(f => f.endsWith(".ts") || f.endsWith(".js"));
    for (const file of files) {
      const table = file.replace(/\.(ts|js)$/, "");
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(path.join(customDir, file));
        customerHooks[table] = mod.default || mod;
      } catch (e) {
        console.error(`[hooks] Failed to load customer hook ${file}:`, e);
      }
    }
  } catch {
    // custom/hooks folder doesn't exist — that's fine
  }
}

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
  };
}

// Cache merged hooks per table
const mergedCache: Record<string, CrudHooks | undefined> = {};

/**
 * Get hooks for a table. Returns merged product + customer hooks, or undefined.
 */
export function getHooks(table: string): CrudHooks | undefined {
  if (table in mergedCache) return mergedCache[table];
  loadCustomerHooks();
  const merged = mergeHooks(productHooks[table], customerHooks[table]);
  mergedCache[table] = merged;
  return merged;
}
