/**
 * Example customer hook for users table.
 * Rename to users.ts to activate.
 *
 * Runs AFTER product hooks (src/lib/hooks/users.ts).
 */
import { ValidationError } from "@/lib/hooks/types";
import type { CrudHooks } from "@/lib/hooks/types";

const hooks: CrudHooks = {
  async beforeSave(body, ctx) {
    // Example: customer requires employee_number on all users
    // if (!body.employee_number?.toString().trim()) {
    //   throw new ValidationError("Employee number is required");
    // }
  },
};

export default hooks;
