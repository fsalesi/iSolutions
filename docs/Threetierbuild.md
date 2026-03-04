\# Three-Tier Inheritance — Implementation Plan



> Build the Engine → Product → Customer inheritance chain so ISS can add

> business logic per form and customers can override without touching ISS code.



\*\*Status:\*\* In Progress

\*\*Started:\*\* 2026-03-03



---



\## Current State



\- `src/lib/crud-route-dynamic.ts` — factory function, no class, no hooks

\- `src/components/pages/FormPage.tsx` — metadata-driven renderer, hardcoded to `/api/f/${formKey}`

\- `src/app/f/\[formKey]/page.tsx` — generic catch-all page route

\- `src/app/api/f/\[formKey]/route.ts` — generic catch-all API route

\- `customer/` folder exists with README only

\- Entity Designer Generate button creates DDL + layout rows only, no files

\- Menu/sidebar injects generated forms as `form:<key>` → loads generic FormPage



\## Target State



```

Engine (never touched per-form):

&nbsp; src/lib/CrudRoute.ts                          ← base class with hook methods

&nbsp; src/components/pages/FormPage.tsx              ← metadata-driven renderer



Product (generated once, ISS customizes):

&nbsp; src/app/api/forms/<form>/route.ts              ← real Next.js API, extends CrudRoute

&nbsp; src/components/forms/<form>/Page.tsx            ← component wrapping FormPage



Customer (generated once, customer customizes):

&nbsp; customer/forms/<form>/route.ts                 ← extends product route class

&nbsp; customer/forms/<form>/Page.tsx                  ← extends product page component

```



Menu always resolves through: customer page → product page → engine FormPage.

API always resolves through: customer route → product route → engine CrudRoute.



---



\## Steps



\### Step 1 — CrudRoute Base Class



\- \[ ] Create `src/lib/CrudRoute.ts` as a class refactor of `crud-route-dynamic.ts`

\- \[ ] Move all core CRUD logic (GET/POST/PUT/DELETE) into class methods

\- \[ ] Add overridable hook methods with default no-op implementations:

&nbsp; - `validate(data, meta, userId)` — called before POST and PUT, throw to reject

&nbsp; - `beforeSave(data, meta, userId, isNew)` — mutate data before insert/update

&nbsp; - `afterSave(saved, meta, userId, isNew)` — side effects after successful save

&nbsp; - `beforeDelete(oid, meta, userId)` — throw to prevent deletion

&nbsp; - `afterDelete(oid, meta, userId)` — cleanup after delete

&nbsp; - `transformRow(row, meta)` — modify row before returning to client (GET)

&nbsp; - `transformList(rows, meta)` — modify list before returning (GET list)

\- \[ ] Keep metadata loading/caching logic (loadMeta, metaCache, CACHE\_TTL)

\- \[ ] Class constructor takes `formKey: string`

\- \[ ] Export helper: `exportRouteHandlers(instance)` that returns `{ GET, POST, PUT, DELETE }`

&nbsp; wrapping class methods into Next.js route handler functions

\- \[ ] TypeScript clean, no regressions



\*\*Key design decisions:\*\*

\- Constructor sets `this.formKey` — subclasses just call `super("suppliers")`

\- Hooks receive parsed metadata so subclasses don't re-query

\- `exportRouteHandlers()` is needed because Next.js route files must export

&nbsp; plain async functions, not class instances



\### Step 2 — FormPage Gets `apiPath` Prop



\- \[ ] Add optional `apiPath?: string` prop to FormPage

\- \[ ] If provided, use it instead of `/api/f/${formKey}` for all fetch calls

\- \[ ] Update all 6 fetch locations in FormPage to use resolved API path:

&nbsp; - Line ~106: child record fetch

&nbsp; - Line ~161: POST/PUT save

&nbsp; - Line ~176: DELETE

&nbsp; - Line ~333: structure fetch (tables list)

&nbsp; - Line ~410: apiPath in CrudPage config

&nbsp; - Any other occurrences

\- \[ ] Generic `/f/\[formKey]` page continues working (no apiPath = old behavior)

\- \[ ] Verify existing POReq form still works via `/api/f/` fallback



\### Step 3 — File Generator



\- \[ ] Create `src/lib/form-file-generator.ts` with function:

&nbsp; `generateFormFiles(formKey: string, formName: string): GenerateResult`

\- \[ ] Generates 4 files (content as template strings):



\*\*Product API route\*\* — `src/app/api/forms/<form>/route.ts`:

```ts

import { CrudRoute, exportRouteHandlers } from "@/lib/CrudRoute";



class <FormName>Route extends CrudRoute {

&nbsp; constructor() { super("<form\_key>"); }



&nbsp; // ISS: Add hooks here

&nbsp; // async validate(data, meta, userId) { ... }

&nbsp; // async beforeSave(data, meta, userId, isNew) { ... }

&nbsp; // async afterSave(saved, meta, userId, isNew) { ... }

}



// Customer override: if customer/forms/<form>/route.ts exists and exports

// a subclass, use that instead. Otherwise use product class.

let RouteClass = <FormName>Route;

try {

&nbsp; const cust = require("@customer/forms/<form>/route");

&nbsp; if (cust?.default) RouteClass = cust.default;

} catch {}



const instance = new RouteClass();

export const { GET, POST, PUT, DELETE } = exportRouteHandlers(instance);

```



\*\*Product page component\*\* — `src/components/forms/<form>/Page.tsx`:

```tsx

import { FormPage } from "@/components/pages/FormPage";



interface Props {

&nbsp; activeNav: string;

&nbsp; onNavigate: (key: string, oid?: string) => void;

}



export default function <FormName>Page({ activeNav, onNavigate }: Props) {

&nbsp; return (

&nbsp;   <FormPage

&nbsp;     formKey="<form\_key>"

&nbsp;     apiPath="/api/forms/<form\_key>"

&nbsp;     activeNav={activeNav}

&nbsp;     onNavigate={onNavigate}

&nbsp;   />

&nbsp; );

}



// ISS: Override by adding custom tabs, toolbar buttons, or renderers:

// export function getExtraTabs() { return \[...]; }

// export function getExtraToolbarButtons() { return \[...]; }

```



\*\*Customer API route\*\* — `customer/forms/<form>/route.ts`:

```ts

import <FormName>Route from "@/app/api/forms/<form>/route";

// ↑ This import path may need adjustment — see note below



/\*\*

&nbsp;\* Customer override for <FormName> API route.

&nbsp;\* Extend the product route and override hooks as needed.

&nbsp;\*

&nbsp;\* Example:

&nbsp;\*   async validate(data, meta, userId) {

&nbsp;\*     await super.validate(data, meta, userId);

&nbsp;\*     if (!data.custom\_field) throw new Error("Custom field required");

&nbsp;\*   }

&nbsp;\*/

export default class Customer<FormName>Route extends <FormName>Route {

&nbsp; // Add customer hooks here

}

```



\*\*Customer page component\*\* — `customer/forms/<form>/Page.tsx`:

```tsx

/\*\*

&nbsp;\* Customer override for <FormName> page.

&nbsp;\* Import and re-export the product page, or replace entirely.

&nbsp;\*

&nbsp;\* Example — add a custom tab:

&nbsp;\*   import ProductPage from "@/components/forms/<form>/Page";

&nbsp;\*   export default function Page(props) {

&nbsp;\*     return <ProductPage {...props} extraTabs={\[...]} />;

&nbsp;\*   }

&nbsp;\*/

export { default } from "@/components/forms/<form>/Page";

```



\- \[ ] Generator checks if files already exist — \*\*never overwrites\*\*

\- \[ ] Returns `{ created: string\[], skipped: string\[] }` for UI feedback

\- \[ ] File paths use `formKey` (snake\_case) for directories, PascalCase for class names



\### Step 4 — Wire Generator into Entity Designer



\- \[ ] Update `/api/forms/generate/route.ts` to call `generateFormFiles()` after DDL + layout

\- \[ ] Add `writeGeneratedFile()` helper that writes to disk via `fs.writeFileSync`

&nbsp; with `{ recursive: true }` for directory creation

\- \[ ] Return file generation results in the API response:

&nbsp; `{ ops, executed, errors, is\_generated, layoutInserted, filesCreated, filesSkipped }`

\- \[ ] Update EntityDesigner UI to show file generation results in the toast/alert:

&nbsp; "Created 4 files" or "3 created, 1 skipped (already exists)"



\### Step 5 — Path Alias for Customer Layer



\- \[ ] Add `@customer/\*` path alias in `tsconfig.json`:

&nbsp; ```json

&nbsp; "paths": {

&nbsp;   "@/\*": \["./src/\*"],

&nbsp;   "@customer/\*": \["./customer/\*"]

&nbsp; }

&nbsp; ```

\- \[ ] Verify Next.js resolves `@customer/forms/suppliers/route` → `customer/forms/suppliers/route.ts`

\- \[ ] Test that missing customer files don't crash (try/catch in product route)



\### Step 6 — SPA Loader (Dynamic Page Resolution)



\- \[ ] Update `page.tsx` (root) to resolve form pages through the three-tier chain:

&nbsp; ```

&nbsp; activeNav = "form:suppliers"

&nbsp; 1. Try: dynamic import customer/forms/suppliers/Page

&nbsp; 2. Fallback: dynamic import src/components/forms/suppliers/Page

&nbsp; 3. Final fallback: generic <FormPage formKey="suppliers" />

&nbsp; ```

\- \[ ] Use Next.js `dynamic()` with `{ ssr: false }` for the imports

\- \[ ] Handle import failures gracefully (try/catch, fall through)

\- \[ ] Generated forms that haven't been file-generated yet still work via fallback



\### Step 7 — Menu Integration



\- \[ ] Sidebar nav entries for generated forms already work (`form:<key>`)

\- \[ ] No URL change needed — SPA loads the right component via Step 6

\- \[ ] Verify clicking a generated form in sidebar → loads customer page → product page → FormPage

\- \[ ] `/f/\[formKey]` standalone route continues working for direct URL access



\### Step 8 — Keep `/api/f/\[formKey]` as Fallback



\- \[ ] Do NOT remove the generic dynamic API route

\- \[ ] It serves as fallback for:

&nbsp; - Forms that haven't been file-generated yet

&nbsp; - Entity Designer preview mode

&nbsp; - Any edge case where product files don't exist

\- \[ ] Document that `/api/forms/<key>` is the production path, `/api/f/<key>` is the fallback



\### Step 9 — End-to-End Test



\- \[ ] Open Entity Designer, select POReq (or create a test form)

\- \[ ] Click Generate — verify:

&nbsp; - \[ ] DDL executes (tables created/updated)

&nbsp; - \[ ] Layout rows generated

&nbsp; - \[ ] 4 files created on disk

&nbsp; - \[ ] Toast shows file creation results

\- \[ ] Navigate to the form via sidebar menu

\- \[ ] Verify it loads through the three-tier chain (not generic FormPage)

\- \[ ] Verify CRUD operations work through `/api/forms/<key>` route

\- \[ ] Add a hook in the product route (e.g., console.log in beforeSave) — verify it fires

\- \[ ] Add an override in the customer route — verify it overrides product behavior



---



\## File Inventory (per generated form)



| File | Layer | Purpose | Created by | Overwritten on re-generate? |

|------|-------|---------|------------|----------------------------|

| `src/lib/CrudRoute.ts` | Engine | Base CRUD class | Hand-coded | N/A (not per-form) |

| `src/components/pages/FormPage.tsx` | Engine | Metadata renderer | Hand-coded | N/A (not per-form) |

| `src/app/api/forms/<form>/route.ts` | Product | Next.js API route | Generator | \*\*No\*\* — created once |

| `src/components/forms/<form>/Page.tsx` | Product | Page component | Generator | \*\*No\*\* — created once |

| `customer/forms/<form>/route.ts` | Customer | API override shim | Generator | \*\*No\*\* — never touched |

| `customer/forms/<form>/Page.tsx` | Customer | Page override shim | Generator | \*\*No\*\* — never touched |



\## Open Questions



1\. \*\*Customer route import path\*\* — The customer route needs to import the product

&nbsp;  route class. But the product route file also does the customer resolution.

&nbsp;  We may need to export the raw class separately from the route handler exports.

&nbsp;  Solution: Product route exports both the class AND the handlers:

&nbsp;  ```ts

&nbsp;  export class SuppliersRoute extends CrudRoute { ... }

&nbsp;  export const { GET, POST, PUT, DELETE } = exportRouteHandlers(...);

&nbsp;  ```



2\. \*\*Dynamic import reliability\*\* — Next.js `dynamic()` may not handle missing

&nbsp;  files gracefully at build time. May need a registry approach instead:

&nbsp;  ```ts

&nbsp;  // src/lib/form-registry.ts

&nbsp;  const registry: Record<string, ComponentType> = {};

&nbsp;  export function registerForm(key: string, component: ComponentType) { ... }

&nbsp;  ```

&nbsp;  Or use `require()` with try/catch since this is a SPA (client-side only).



3\. \*\*Re-generate safety\*\* — If ISS has added code to product files and someone

&nbsp;  clicks Generate again, we must not overwrite. The generator checks file existence

&nbsp;  and skips. But what if the schema changes and we need to update the product route?

&nbsp;  Answer: Schema changes don't affect the route file — the route reads metadata

&nbsp;  at runtime. Only the DDL and layout rows are re-generated.

