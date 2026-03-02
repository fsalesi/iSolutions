import { ValidationError } from "./types";
import type { CrudHooks, HookContext } from "./types";

const hooks: CrudHooks = {
  async beforeSave(body, ctx) {
    // Validate delegate_id is a valid, active, different user
    const delegate = body.delegate_id?.toString().trim();
    if (delegate) {
      const res = await ctx.db.query(
        `SELECT user_id, is_active FROM users WHERE user_id = $1`,
        [delegate]
      );
      if (!res.rows.length) {
        throw new ValidationError(`Delegate "${delegate}" does not exist`);
      }
      if (!res.rows[0].is_active) {
        throw new ValidationError(`Delegate "${delegate}" is not an active user`);
      }
      // Can't delegate to yourself
      const userId = body.user_id?.toString().trim();
      if (userId && delegate.toLowerCase() === userId.toLowerCase()) {
        throw new ValidationError("A user cannot be their own delegate");
      }
    }
  },
};

export default hooks;
