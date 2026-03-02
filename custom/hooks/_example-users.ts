/**
 * Example customer hook for users table.
 * Rename to users.ts to activate, then register in src/lib/hooks/index.ts.
 *
 * Runs AFTER product hooks (src/lib/hooks/users.ts).
 */
import { ValidationError } from "@/lib/hooks/types";
import type { CrudHooks } from "@/lib/hooks/types";

const hooks: CrudHooks = {
  async beforeSave(body, ctx) {
    // Example: customer requires employee_number on all users
    // if (!body.employee_number?.toString().trim()) {
    //   throw new ValidationError("message.employee_number_required");
    // }
  },
};

export default hooks;
