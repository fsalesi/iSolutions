# Three-Tier Inheritance — Implementation Plan

> Build the Engine → Product → Customer inheritance chain so ISS can add
> business logic per form and customers can override without touching ISS code.

**Status:** In Progress
**Started:** 2026-03-03

---

## Current State

- ~~`src/lib/crud-route-dynamic.ts` — factory function, no class, no hooks~~ **DELETED**
- `src/components/pages/FormPage.tsx` — metadata-driven renderer, hardcoded to `/api/f/${formKey}`
- ~~`src/app/f/[formKey]/page.tsx` — generic catch-all page route~~ **DELETED**
- ~~`src/app/api/f/[formKey]/route.ts` — generic catch-all API route~~ **DELETED**
- `customer/` folder exists with README only
- Entity Designer Generate button creates DDL + layout rows only, no files
- Menu/sidebar injects generated forms as `form:<key>` → loads generic FormPage

## Target State

```
Engine (never touched per-form):
  src/lib/CrudRoute.ts                          ← base class with hook methods
  src/components/pages/FormPage.tsx              ← metadata-driven renderer

Product (generated once, ISS customizes):
  src/app/api/forms/<form>/route.ts              ← real Next.js API, extends CrudRoute
  src/components/forms/<form>/Page.tsx            ← component wrapping FormPage

Customer (generated once, customer customizes):
  customer/forms/<form>/route.ts                 ← extends product route class
  customer/forms/<form>/Page.tsx                  ← extends product page component
```

Menu always resolves through: customer page → product page → engine FormPage.
API always resolves through: customer route → product route → engine CrudRoute.

---

## Steps

### Step 1 — CrudRoute Base Class ✅

- [x] Create `src/lib/CrudRoute.ts` as a class (511 lines)
- [x] Move all core CRUD logic (GET/POST/PUT/DELETE) into class methods
  - `handleGET()`, `handlePOST()`, `handlePUT()`, `handleDELETE()`
- [x] Add overridable hook methods with default no-op implementations:
  - `validate(data, meta, userId)` — called before POST and PUT, throw to reject
  - `beforeSave(data, meta, userId, isNew)` — mutate data before insert/update
  - `afterSave(saved, meta, userId, isNew)` — side effects after successful save
  - `beforeDelete(oid, meta, userId)` — throw to prevent deletion
  - `afterDelete(oid, meta, userId)` — cleanup after delete
  - `transformRow(row, meta)` — modify row before returning to client (GET)
  - `transformList(rows, meta)` — modify list before returning (GET list)
- [x] Keep metadata loading/caching logic (loadMeta, metaCache, CACHE_TTL)
- [x] Class constructor takes `formKey: string`
- [x] Export helper: `exportRouteHandlers(instance)` that returns `{ GET, POST, PUT, DELETE }`
  wrapping class methods into Next.js route handler functions
- [x] Export `clearCrudRouteMetaCache(formKey?)` for cache management
- [x] Export types: `TableMeta`, `FieldMeta`, `ColType`
- [x] TypeScript clean (0 new errors)
- [x] Deleted old files:
  - `src/lib/crud-route-dynamic.ts` — replaced by CrudRoute class
  - `src/app/f/[formKey]/page.tsx` — no longer needed
  - `src/app/api/f/[formKey]/route.ts` — no longer needed
- [x] Cleaned stale `/f/` href from AppShell sidebar nav

### Step 2 — FormPage Gets `apiPath` Prop ✅

- [x] Add required `apiPath: string` prop to FormPage
- [x] Replace all hardcoded `/api/f/${formKey}` with `apiPath`-based URLs:
  - Line ~106: child record fetch
  - Line ~161: POST/PUT save
  - Line ~176: DELETE
  - Line ~333: structure fetch (tables list)
  - Line ~410: apiPath in CrudPage config
- [x] Update root page.tsx FormPage usage to pass apiPath
- [x] Verify TypeScript clean

### Step 3 — File Generator ✅

- [x] Create `src/lib/form-file-generator.ts` with function:
  `generateFormFiles(formKey: string, formName: string): GenerateResult`
- [x] Generates 4 files (content as template strings):

**Product API route** — `src/app/api/forms/<form>/route.ts`:
```ts
import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";

export class <FormName>Route extends CrudRoute {
  constructor() { super("<form_key>"); }

  // ISS: Add hooks here
  // async validate(data, meta, userId) { ... }
  // async beforeSave(data, meta, userId, isNew) { ... }
  // async afterSave(saved, meta, userId, isNew) { ... }
}

// Customer override: if customer route exists, use that instead
let RouteClass: typeof CrudRoute = <FormName>Route;
try {
  const cust = require("@customer/forms/<form>/route");
  if (cust?.default) RouteClass = cust.default;
} catch {}

const instance = new RouteClass();
export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);
```

**Product page component** — `src/components/forms/<form>/Page.tsx`:
```tsx
import { FormPage } from "@/components/pages/FormPage";

interface Props {
  activeNav: string;
  onNavigate: (key: string, oid?: string) => void;
}

export default function <FormName>Page({ activeNav, onNavigate }: Props) {
  return (
    <FormPage
      formKey="<form_key>"
      apiPath="/api/forms/<form_key>"
      activeNav={activeNav}
      onNavigate={onNavigate}
    />
  );
}

// ISS: Override by adding custom tabs, toolbar buttons, or renderers
```

**Customer API route** — `customer/forms/<form>/route.ts`:
```ts
import { <FormName>Route } from "@/app/api/forms/<form>/route";

/**
 * Customer override for <FormName> API route.
 * Extend the product route and override hooks as needed.
 */
export default class Customer<FormName>Route extends <FormName>Route {
  // Add customer hooks here
}
```

**Customer page component** — `customer/forms/<form>/Page.tsx`:
```tsx
/**
 * Customer override for <FormName> page.
 * Import and re-export the product page, or replace entirely.
 */
export { default } from "@/components/forms/<form>/Page";
```

- [x] Generator checks if files already exist — **never overwrites**
- [x] Returns `{ created: string[], skipped: string[] }` for UI feedback
- [x] File paths use `formKey` (snake_case) for directories, PascalCase for class names

### Step 4 — Wire Generator into Entity Designer ✅

- [x] Update `/api/forms/generate/route.ts` to call `generateFormFiles()` after DDL + layout
- [x] Return file generation results in the API response:
  `{ ops, executed, errors, is_generated, layoutInserted, filesCreated, filesSkipped }`
- [x] Update EntityDesigner UI to show file generation results in the toast/alert

### Step 5 — Path Alias for Customer Layer ✅

- [x] Add `@customer/*` path alias in `tsconfig.json`
- [x] Verify Next.js resolves customer imports
- [x] Test that missing customer files don't crash (try/catch in product route)

### Step 6 — SPA Loader (Dynamic Page Resolution) ✅

- [x] Update `page.tsx` (root) to resolve form pages through the three-tier chain:
  ```
  activeNav = "form:suppliers"
  1. Try: dynamic import src/components/forms/suppliers/Page
  2. Final fallback: generic <FormPage formKey="suppliers" apiPath="..." />
  ```
- [x] Use Next.js `dynamic()` or a registry for the imports
- [x] Handle import failures gracefully (try/catch, fall through)

### Step 7 — Menu Integration ✅

- [x] Sidebar nav entries for generated forms already work (`form:<key>`)
- [x] Verify clicking a generated form in sidebar → loads correct page
- [x] SPA loads the right component via Step 6

### Step 8 — End-to-End Test ✅

- [x] Open Entity Designer, select POReq (or create a test form)
- [x] Click Generate — verify:
  - [x] DDL executes (tables created/updated)
  - [x] Layout rows generated
  - [x] 4 files created on disk
  - [x] Toast shows file creation results
- [x] Navigate to the form via sidebar menu
- [x] Verify it loads through the three-tier chain
- [x] Verify CRUD operations work through `/api/forms/<key>` route
- [x] Add a hook in the product route (e.g., console.log in beforeSave) — verify it fires
- [x] Add an override in the customer route — verify it overrides product behavior

---

## File Inventory (per generated form)

| File | Layer | Purpose | Created by | Overwritten on re-generate? |
|------|-------|---------|------------|----------------------------|
| `src/lib/CrudRoute.ts` | Engine | Base CRUD class | Hand-coded | N/A (not per-form) |
| `src/components/pages/FormPage.tsx` | Engine | Metadata renderer | Hand-coded | N/A (not per-form) |
| `src/app/api/forms/<form>/route.ts` | Product | Next.js API route | Generator | **No** — created once |
| `src/components/forms/<form>/Page.tsx` | Product | Page component | Generator | **No** — created once |
| `customer/forms/<form>/route.ts` | Customer | API override shim | Generator | **No** — never touched |
| `customer/forms/<form>/Page.tsx` | Customer | Page override shim | Generator | **No** — never touched |

## Open Questions

1. **Customer route import path** — The customer route needs to import the product
   route class. The product route exports the class as a named export so the
   customer file can extend it:
   ```ts
   export class SuppliersRoute extends CrudRoute { ... }
   export const { GET, POST, PUT, DELETE } = exportRouteHandlers(...);
   ```

2. **Dynamic import reliability** — Next.js `dynamic()` may not handle missing
   files gracefully at build time. May need a registry approach instead.

3. **Re-generate safety** — Generator checks file existence and skips.
   Schema changes don't affect route files — routes read metadata at runtime.
   Only DDL and layout rows are re-generated.
