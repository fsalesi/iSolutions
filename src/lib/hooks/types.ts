import type { Pool, PoolClient } from "pg";

/**
 * Thrown by hooks to reject a save/delete with a user-facing message.
 * crud-route catches this and returns 422 with the message.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
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
