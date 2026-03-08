# Customer Hooks

Place customer-specific CRUD hooks in this folder.
Files are named by table: `<table>.ts` (e.g. `users.ts`, `locales.ts`).

Each file should export a default `CrudHooks` object:

```ts
import { ValidationError } from "@/lib/hooks/types";
import type { CrudHooks } from "@/lib/hooks/types";

const hooks: CrudHooks = {
  async beforeSave(body, ctx) {
    // Custom validation — throw ValidationError to reject
  },
  async afterSave(body, ctx) {
    // Side effects after save
  },
  async beforeDelete(oid, ctx) {
    // Custom delete validation
  },
};

export default hooks;
```

Hooks run AFTER product hooks (src/lib/hooks/<table>.ts).
Either layer can throw `ValidationError` to reject the operation.

This folder is outside the main source tree so customer
customizations don't conflict with product upgrades.
