import type { Pool } from "pg";

/**
 * Thrown by hooks to reject a save/delete.
 * Carries a translation key and optional named params.
 *
 * Usage:
 *   throw new ValidationError("message.delegate_inactive", { delegate: "bob" });
 *
 * crud-route resolves the key to the user's locale and substitutes params.
 */
export class ValidationError extends Error {
  /** Translation key, e.g. "message.delegate_inactive" */
  translationKey: string;
  /** Named params for {placeholder} substitution */
  params: Record<string, string | number>;

  constructor(key: string, params?: Record<string, string | number>) {
    super(key); // fallback message is the key itself
    this.name = "ValidationError";
    this.translationKey = key;
    this.params = params || {};
  }
}

/** Context passed to every hook */
export interface HookContext {
  /** Database pool — use for queries */
  db: Pool;
  /** True when creating a new record (POST), false on update (PUT) */
  isNew: boolean;
  /** The oid of the record (empty string on POST before insert) */
  oid: string;
  /** The table name */
  table: string;
}

/** Hook functions a table can define */
export interface CrudHooks {
  /** Runs before INSERT or UPDATE. Throw ValidationError to reject. */
  beforeSave?: (body: Record<string, any>, ctx: HookContext) => Promise<void>;
  /** Runs after INSERT or UPDATE — for side effects. */
  afterSave?: (body: Record<string, any>, ctx: HookContext) => Promise<void>;
  /** Runs before DELETE. Throw ValidationError to reject. */
  beforeDelete?: (oid: string, ctx: Omit<HookContext, "isNew">) => Promise<void>;
}
