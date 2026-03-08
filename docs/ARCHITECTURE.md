# iSolutions v2 — Architecture & Development Guide

> **Status:** Active development — Form Platform v2 in production.
> The v1 codebase has been moved to `/apps/iSolutions/backup/` for reference only.
> Do NOT use v1 patterns. Everything below describes v2.

---

## What Is iSolutions?

iSolutions is a modern SaaS ERP platform (Next.js + PostgreSQL) designed to replace
iPurchase, a legacy Progress/OpenEdge procurement system. It is built and maintained
by Frank Salesi.

---

## Current State

The Form Platform v2 is live and running at **https://isolutions.salesi.net** (nginx
→ localhost:3001, running in dev mode).

```
/apps/iSolutions/src/
  platform/core/        ← v2 base classes (PageDef, PanelDef, DataGridDef, ...)
  components/           ← React renderers (EditPanelRenderer, DataGridRenderer, ...)
  app/api/              ← Next.js API routes (CrudRoute base class)
  page-defs/            ← Product page definitions (one folder per page)
/apps/iSolutions/work/  ← Customer overrides (@customer alias in tsconfig)
/apps/iSolutions/backup/← v1 reference code and original design docs (read-only)
/apps/iSolutions/docs/  ← v2 architecture and design documents (this file)
```

### Server Management
- Dev mode: `cd /apps/iSolutions && npm run dev -- -p 3001`
- Kill + rebuild + restart: `fuser -k 3001/tcp; sleep 1 && cd /apps/iSolutions && npm run build && npm run start -- -p 3001`
- **Never restart services directly** — only Frank does this.

---

## The Form Platform v2 Design

### Core Concept

Every page is a **class tree**. A `PageDef` constructs a `DataGridDef` and a
`PanelDef`, wires them together, and the grid drives the panel. When a user selects
a row, the grid calls `panel.display(row)`, which cascades through every tab →
section → field/child-grid in the tree.

### Two-Layer Inheritance

```
ProductPage   — constructs and wires the full object tree, bakes in product logic
CustomerPage  — extends ProductPage, calls super(), then surgically overrides only what they need
```

### The Object Tree

```
PageDef
  └── grid: DataGridDef
        ├── columns: ColumnDef[]
        └── editPanel: PanelDef             ← injected by page, not owned by grid
              ├── currentRecord: Row | null
              ├── displayMode: inline | slide-in-right | modal-centered
              ├── toolbar: ToolbarDef
              └── tabs: TabDef[]
                    └── children: ChildElement[]
                          ├── SectionDef
                          │     └── children: ChildElement[]
                          │           └── FieldDef
                          └── DataGridDef   ← child grid, driven by parent panel
```

### Constructor Injection

Sub-objects are constructed inside the parent class and wired via assignment:

```ts
export class SsoPage extends PageDef {
  protected grid      = new SsoGrid(this);
  protected editPanel = new SsoEditPanel(this);
}
```

The `this` reference is passed into child constructors so they can call back to
the parent if needed, and so all objects have back-references without needing props.

### The display() Cascade

`panel.display(row)` is the single cascade entry point. It:
1. Sets `currentRecord = row`
2. Calls `display(row)` on every tab → each tab forwards to its children
3. Fields extract `row[key]` and set their value
4. Child grids filter and fetch using the parent row
5. Refreshes toolbar state (enable/disable buttons based on record presence)

---

## The Golden Rule: No Prop Drilling

> **Never pass data down the React tree as props when the information already
> exists on the model objects.**

v2 uses a class/object model that sits alongside React. Every renderer receives
a **single model object** (a `PanelDef`, `FieldDef`, `TabDef`, etc.) and reads
everything it needs directly from that object. Model objects hold back-references
to their parents so any node can walk up the tree.

### What this means in practice

| ✅ Do this | ❌ Never do this |
|-----------|-----------------|
| `field.panel.currentRecord` | Pass `currentRecord` as a prop to FieldRenderer |
| `field.panel.isNew` | Pass `isNew` as a prop |
| `toolbar.panel?.currentRecord` | Pass `record` as a prop to PanelToolbar |
| `panel.table` | Pass `table` as a prop to AuditPanel or NotesPanel |

### Back-references stamped lazily

`PanelDef._init()` walks the tab → section → field tree and stamps `field.panel`
on every field. This means fields always know which panel owns them without
needing a prop.

---

## UI-Only State Belongs in the Renderer

Toolbar buttons manage their own open/close state — this is a UI concern, not a
model concern. **Do not add state like `auditOpen` or `notesOpen` to `PanelDef`
or `ToolbarDef`.**

```ts
// ✅ Correct — PanelToolbar.tsx owns its own drawer state
const [auditOpen, setAuditOpen] = useState(false);
const [notesOpen, setNotesOpen] = useState(false);
```

The toolbar reads `toolbar.useAudit` and `toolbar.useNotes` (booleans on
`ToolbarDef`) to decide whether to render the buttons. The open/close state of
the drawers is purely a React concern.

---

## Toolbar Architecture

`ToolbarDef` carries feature flags. Renderers decide whether to show/hide buttons
and which panels to mount:

```ts
class ToolbarDef {
  useAudit:  boolean = false;
  useNotes:  boolean = false;
}
```

Enable them on the panel's toolbar in your page-def:

```ts
this.toolbar = new ToolbarDef({
  useNotes: true,
  useAudit: true,
});
```

`PanelToolbar.tsx` reads these flags to conditionally render the Notes and Audit
buttons, and mounts the corresponding slide-in panels (`NotesPanel`, `AuditPanel`)
inline. Both panels read `table` and `recordOid` from the model — no props passed.

### Toolbar Button Visibility
- Buttons are always **visible** — they are **enabled/disabled** based on state.
- Never hide a button based on record selection; disable it instead.

---

## Slide-In Panel Pattern (Audit, Notes)

Both `AuditPanel` and `NotesPanel` follow the same pattern:

1. `PanelToolbar` owns `auditOpen` / `notesOpen` state via `useState`
2. On button click, it reads `table` and `recordOid` from `toolbar.panel` (back-ref)
3. Renders the panel inline — no separate route, no prop drilling
4. Panel fetches its own data via `/api/audit-log` or `/api/notes`

```tsx
// In PanelToolbar.tsx — the canonical pattern
const table     = toolbar.panel?.table ?? "";
const recordOid = toolbar.panel?.currentRecord?.oid ?? "";

<NotesPanel
  table={table}
  recordOid={recordOid}
  open={notesOpen}
  onClose={() => setNotesOpen(false)}
/>
```

---

## Dirty Tracking

- `PanelDef` owns `isDirty: boolean`
- Fields raise dirty via `field.panel.setDirty(true)` (back-ref, no props)
- `field.panel` is stamped lazily by `PanelDef._init()`
- `isNew` is a getter on `PanelDef` that returns `!currentRecord?.oid`
- Save button enables when `isDirty || isNew`

---

## Callback Naming Convention

Direct callbacks on the model (not events/pub-sub):

| Callback | Where | Purpose |
|----------|-------|---------|
| `onDisplay` | `PanelDef` | Called after panel displays a record |
| `onDirtyChanged` | `PanelDef` | Called when dirty state changes |
| `onFetch` | `DataGridDef` | Called after grid fetches rows |
| `onFocusTab` | `PanelDef` | Called when a tab is clicked |

No event bus, no pub-sub. Direct callbacks only.

---

## Translation / i18n Architecture

### Source of Truth

Base product translations live in files under `src/lib/i18n/messages/`. The file
catalog is the canonical source of truth. Database translations are **overrides only**
for runtime/customer-specific wording.

```
src/lib/i18n/
  types.ts
  catalog.ts
  resolve.ts
  runtime.ts
  messages/
    en-us.ts
    it-it.ts
```

### Core Rule

> **Do not scatter `t("...")` calls through JSX.**
> Translation belongs in the object model and shared core helpers.

Developers define text once in metadata and renderers resolve it automatically.

```ts
label: tx("users.fields.email", "Email")
titleText: tx("users.title", "Users")
```

Plain strings are still allowed during development, but the preferred pattern is:
- `tx(key, fallback)` for labels/titles/button text
- `tx(key, fallback, params)` for parameterized messages

### Where Translation Logic Lives

- `src/lib/i18n/*` — shared catalog + resolver + runtime helpers
- `src/context/TranslationContext.tsx` — client locale state and `setLocale()`
- `src/lib/translate.ts` — server-side resolver

Renderers should consume resolved text, not invent translation behavior.

### DataSourceDef Is Canonical

`DataSourceDef` is the canonical source for field/column metadata used by grids,
panels, lookups, and other consumers. Default labels are generated there, not in
individual pages.

Schema/route columns should resolve by default as:

```ts
tx(`${table}.columns.${key}`, toLabel(key))
```

This means a column exposed by the data source automatically participates in i18n
without requiring every page to override its label manually. Page defs should only
override labels when they intentionally want different wording.

### Messages / Phrases

The system must support parameterized phrases, not just static labels.

```ts
tx("users.confirm.delete", "Do you want to delete user {name}?", { name })
```

Use this pattern for:
- delete confirmations
- validation messages
- status/toast text
- advanced filter prompts and saved-filter messaging

### Locale Switching

Locale switching is shell-owned. The current locale is changed through the
translation context and persisted to the user profile. UI should react immediately
after `setLocale(...)`.

### Development Rule

When adding a new page or feature:
1. Put canonical base strings in `en-us.ts`
2. Add other locales in sibling files (for example `it-it.ts`)
3. Define labels/messages in metadata with `tx(...)`
4. Let grids/panels/toolbars render resolved text automatically

Do not make the database the primary source of product UI text.

---

## API Layer

All API routes extend `CrudRoute` which provides:
- `GET ?table=x&search=y&filters=...&sort=col&dir=asc&offset=0&limit=50`
- `POST`, `PUT`, `DELETE` with auth and field validation
- `searchColumns` auto-derived from first 4 text columns

**Always include `?table=tablename`** in API calls — `CrudRoute` dispatches on
this parameter.

### Audit Log
- Table: `audit_log`
- Trigger naming: `trg_{tablename}_audit`
- API: `GET /api/audit-log?table=x&oid=y`
- Cache bug fix: `getAuditedTables()` now queries `information_schema.triggers`
  fresh on every request (no module-level cache)

### Notes
- Tables: `notes`, `note_attachments`, `note_mentions`
- API: `GET /api/notes?table=x&oid=y&limit=200`
- Mention search: `GET /api/users?table=users&search=q&limit=8`
  (must include `?table=users` — CrudRoute dispatches on this)

---

## Tab Validation

- `TabDef` has a `hasError: boolean` flag
- `FieldRenderer` sets `field.tab.hasError = true` when a field has an error
- `TabRenderer` renders a colored dot on tabs that have errors
- `onFocusTab` callback fires when the user clicks a tab (for custom validation)

---

## The display() / isNew Pattern for Fields

`FieldRenderer` uses `field.panel?.isNew` to decide whether the key field is
editable. Key fields (`field.isKeyField`) are read-only on existing records but
editable on new ones:

```ts
const effectiveReadOnly =
  field.readOnly || (field.isKeyField && !field.panel?.isNew);
```

---

## Key Interfaces

### ChildElement
Every node implements this:
```ts
interface ChildElement {
  type: "field" | "tab" | "section" | "grid" | "custom"
  key: string
  hidden: boolean
  display(row: Row | null): void
}
```

### RendererType
```ts
// Field renderers
"text" | "number" | "date" | "datetime" | "checkbox"
"select" | "lookup" | "textarea" | "password" | "readonly" | "image"

// Column renderers (grid context)
"badge" | "currency" | "boolean" | "dateDisplay"
```

### DisplayMode (PanelDef)
```ts
"inline" | "slide-in-right" | "modal-centered"
```

### GridMode (DataGridDef)
```ts
"browse"    // full CRUD — grid + edit panel + toolbar
"inquiry"   // read-only grid only
"lookup"    // picker mode — fires onSelect, no edit panel
```

---

## Options Interfaces (constructor params)

All classes use explicit data-only options interfaces — no `Object.assign`, no
risk of accidentally passing methods as constructor options.

- `FieldDefOptions`    — key, label, renderer, required, readOnly, lookupConfig, options, ...
- `ColumnDefOptions`   — key, label, renderer, sortable, width, dataType, ...
- `SectionDefOptions`  — key, label, columns, children, hideLabel, ...
- `TabDefOptions`      — key, label, icon, children, hideLabel, ...
- `DataGridDefOptions` — key, table, api, mode, pageSize, allowSearch, ...

---

## Customer Override Pattern

```ts
export class AcmeUserMaintPage extends UserMaintPage {
  constructor() {
    super()                        // full product tree already wired
    this.grid.getColumn("wus_id").label = "Employee ID"
    this.grid.editPanel.toolbar.addButton({ key: "syncAD", label: "Sync AD", onClick: () => {} })
    this.grid.editPanel.getTab("details").getSection("main")
        .addChild(new FieldDef({ key: "acme_dept", label: "Department" }))
  }
}
```

Customer overrides live in `/apps/iSolutions/work/` and are imported via
`@customer` alias in `tsconfig.json`. They never touch the product source.

---

## Development Rules

1. **Load this doc first** — before writing any code for iSolutions.
2. **Never use v1 patterns** — `CrudPage`, `SplitCrudPage`, `FormPage`,
   `createCrudRoutes` are all in backup. Do not reference them for new work.
3. **No prop drilling** — never pass data down the React tree when it already
   exists on the model objects. Use back-references (`field.panel`, `toolbar.panel`).
4. **No callbacks on PanelDef for UI-only concerns** — toolbar open/close state
   lives in the toolbar renderer, not the model.
5. **Stubs are intentional** — do not implement stubbed methods until authorized.
6. **No git commit/push without Frank's explicit authorization** — stop, show what
   would be committed, and wait.
7. **Never restart services** — only Frank stops/starts/restarts services.
8. **File writes** — use `ipurchase:execute_command` with Python `open(..., "w")`
   or heredoc.
9. **iSolutions app DB** — `PGPASSWORD=ipurchase psql -h localhost -U ipurchase -d isolutions`

---

## Active File Inventory

| File | Purpose |
|------|---------|
| `src/platform/core/PageDef.ts` | Base page — arrays + getters only |
| `src/platform/core/PanelDef.ts` | Full CRUD + dirty tracking + onFocusTab |
| `src/platform/core/EditPanel.tsx` | Extends PanelDef |
| `src/platform/core/DataGridDef.tsx` | onFetch callback |
| `src/platform/core/ToolbarDef.ts` | useAudit + useNotes flags |
| `src/platform/core/FieldDef.ts` | setValue, defaultValue, panel back-ref |
| `src/platform/core/TabDef.ts` | hasError flag |
| `src/platform/core/SectionDef.ts` | display() cascade |
| `src/components/grid/DataGridRenderer.tsx` | onFetch wired |
| `src/components/grid/CellRenderer.tsx` | Renderer dispatch |
| `src/components/panel/EditPanelRenderer.tsx` | onDisplay + onDirtyChanged |
| `src/components/panel/PanelToolbar.tsx` | auditOpen/notesOpen state + drawers |
| `src/components/panel/TabRenderer.tsx` | onFocusTab wired + error dots |
| `src/components/panel/SectionRenderer.tsx` | onChange → field.setValue |
| `src/components/panel/FieldRenderer.tsx` | useState + effectiveReadOnly via isNew |
| `src/components/panel/AuditFooter.tsx` | Audit timestamps footer |
| `src/components/audit-panel/AuditPanel.tsx` | Slide-in audit history drawer |
| `src/components/notes-panel/NotesPanel.tsx` | Slide-in notes/chat drawer |
| `src/components/ui/index.tsx` | Input, Select, Badge, etc. |
| `src/components/ui/Toggle.tsx` | Toggle switch |
| `src/components/ui/DatePicker.tsx` | Date picker |
| `src/components/ui/NumberInput.tsx` | Numeric input |
| `src/app/api/audit-log/route.ts` | Audit log API (no cache — fresh per request) |
| `src/app/api/notes/route.ts` | Notes CRUD API |
| `src/app/api/notes/attachments/route.ts` | Note attachment upload/download |
| `src/page-defs/sso_config/index.tsx` | SSO Config page (constructor injection) |
| `src/page-defs/sso_config/SsoGrid.ts` | Grid columns |
| `src/page-defs/sso_config/SsoEditPanel.ts` | Tabs/sections/fields; useAudit+useNotes |
| `work/pages/sso_config/index.tsx` | Customer override example |

---

## Full Design Document

The complete object model design — all properties, all methods, all events —
is at:

```
/apps/iSolutions/backup/docs/FormPlatformV2-ObjectModel.md
```

---

## Known Pending Work

| Item | Priority |
|------|----------|
| Toast/message system — replace `alert()` in `PanelDef.showMessage()` | Next |
| Field error display — verify `field.hasError` / `field.errorMessage` end-to-end | Next |
| `getSection(key)` — implement flat tree search | Future |
| Lookup subsystem — `FieldRenderer` lookup stub | Future |
| Image field — blob upload/remove | Future |
| Export, Columns picker, Design mode in GridToolbar | Future |
| AuditFooter — wire into EditPanelRenderer bottom | Future |
