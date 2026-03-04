# CrudPanel Refactor — Task List

Status: `[ ]` = todo, `[x]` = done, `[~]` = in progress

---

## Phase 1: Create Panel Building Blocks (non-breaking)

New components in `src/components/panels/`. No existing files touched.

### Step 1.1 — Create Panel base + helpers

- [x] Create `src/components/panels/Panel.tsx` — base stub
- [x] Create `src/components/panels/InlineConfirm.tsx` — delete confirmation
- [x] Create `src/components/panels/AuditFooter.tsx` — timestamps footer
- [x] Create `src/components/panels/index.ts` — barrel export
- [x] TypeScript clean

### Step 1.2 — Create CrudPanelContext (dirty cascade)

- [x] Create `src/components/panels/CrudPanelContext.tsx`
- [x] `CrudPanelContext` with `registerChild(id, ref)` / `unregisterChild(id)`
- [x] `CrudPanelRef` interface: `canRelease(): Promise<boolean>`
- [x] `useChildRegistry()` hook
- [x] `useRegisterWithParent()` hook
- [x] TypeScript clean

### Step 1.3 — Create CrudPanel component

- [x] Create `src/components/panels/CrudPanel.tsx`
- [x] Props: `row`, `isNew`, `apiPath`, `tableName`, `renderBody`, `onSaved`, `onDeleted`, `onNew`
- [x] Optional props: `colTypes`, `colScales`, `extraActions`, `defaultValues`, `savePayloadExtras`, `renderEmpty`, `isAdmin`, `deleteLabel`, `onDirtyChange`
- [x] Internal state: `form`, `isDirty`, `saving`, `error`, `confirmDelete`, `noteCount`, `notesOpen`, `auditOpen`
- [x] Handlers: save (POST/PUT), delete, copy
- [x] `canRelease()` via `forwardRef` + `useImperativeHandle` — checks self, then cascades to children
- [x] Publish `CrudPanelContext` for children to register
- [x] Register self with parent `CrudPanelContext` (if exists)
- [x] `beforeunload` guard, DOM-based required field validation
- [x] Render: CrudToolbar, error, InlineConfirm, renderBody, AuditFooter, NotesPanel, AuditPanel
- [x] TypeScript clean

### Step 1.4 — Create SplitPanel component

- [x] Create `src/components/panels/SplitPanel.tsx`
- [x] Props: `storageKey`, `left`, `right`, `defaultPct`, `expanded`
- [x] Draggable splitter with double-click reset, localStorage persistence
- [x] TypeScript clean

---

## Phase 2: Make DataGrid Self-Sufficient

DataGrid currently requires parent to pass fetchPage, colTypes, etc. Make it autonomous.

### Step 2.1 — DataGrid fetches own schema

- [x] Add `table` prop (string) — when provided, DataGrid fetches colTypes/colScales from `/api/columns?table=X`
- [x] Existing `colTypes` prop still works as override (backward compat)
- [x] Schema used for column type formatting, renderer selection

### Step 2.2 — DataGrid builds own fetchPage

- [x] When `table` prop provided and no `fetchPage` prop, DataGrid builds generic fetch: `GET /api/{table}?offset=&limit=&search=&sort=&dir=&filters=`
- [x] Existing `fetchPage` prop still works as override
- [x] `parentFilter` prop for child grids (adds query params)

### Step 2.3 — DataGrid fetches full row on select

- [x] ~~When user clicks row, DataGrid fetches full row~~ Grid already has full row data; passes it directly
- [x] Fires `onSelect(oid, fullRow)` — passes row from grid's own data — signature changes from `(oid) => void` to `(oid, row) => void`
- [x] Backward compat: if consumer ignores second arg, no breakage

### Step 2.4 — DataGrid exposes publisher ref

- [x] `DataPublisher` interface: `{ refresh: () => void }`
- [x] DataGrid exposes `refresh()` via React 19 ref prop + `useImperativeHandle`
- [x] `refresh()` re-fetches current page via refreshTrigger

### Step 2.5 — Verify existing pages still work

- [x] All 8 pages compile (CrudPage passes fetchPage — backward compat)
- [ ] No regressions in sorting, search, pagination, column management, export (needs manual test)

---

## Phase 3: Make CrudPanel Self-Sufficient

CrudPanel currently receives colTypes/colScales as props. Make it autonomous.

### Step 3.1 — CrudPanel fetches own schema

- [x] When `tableName` prop provided and no `colTypes` prop, CrudPanel fetches from `/api/columns?table=X`
- [x] Uses schema to determine requiredFields (via is_nullable), colScales
- [x] Existing props still work as override (colTypesProp/colScalesProp/requiredFieldsProp)

### Step 3.2 — CrudPanel builds empty row

- [x] On "New", CrudPanel builds empty row from its own schema knowledge (buildEmptyRow)
- [x] Merges `defaultValues` prop on top
- [x] No parent involvement in empty row creation

---

## Phase 4: Build useLink Hook + Page Component

### Step 4.1 — Create useLink hook

- [x] Create `src/hooks/useLink.ts`
- [x] `DataPublisher` interface: `{ refresh: () => void }`
- [x] `DataConsumer` interface: `{ canRelease: () => Promise<boolean> }`
- [x] `useLink(publisherRef, consumerRef)` returns (apiPath removed — components own their own):
  - `selectedRow` — current row or null
  - `selectedId` — current oid or null
  - `isNew` — boolean
  - `onSelect(oid, row)` — give to publisher
  - `onNew()` — trigger new record
  - `onSaved(row)` — consumer calls after save
  - `onDeleted()` — consumer calls after delete
- [x] `onSelect` flow: call `canRelease()` on consumer → if yes, update state
- [x] `onSaved` flow: call `refresh()` on publisher, update selectedRow
- [x] `onDeleted` flow: call `refresh()` on publisher, clear selection
- [x] TypeScript clean

---

## Phase 5: Migrate Pages

All existing pages currently use CrudPage. Migrate one at a time to compose building blocks directly.

### Step 5.1 — Migrate Settings (simplest page)

- [ ] Settings.tsx → Page + SplitPanel + DataGrid + CrudPanel + useLink
- [ ] ~40-50 lines: refs, link, columns, defaultValues, renderBody, compose
- [ ] Verify: save, new, delete, copy, dirty guard, notes, audit, required fields, beforeunload

### Step 5.2 — Migrate remaining simple pages

- [ ] Translations → same pattern
- [ ] Locales → same pattern
- [ ] PasoeBrokers → same pattern
- [ ] Each verified after migration

### Step 5.3 — Migrate tabbed pages

- [ ] UsersPage → same pattern with renderTabs → tab content in renderBody
- [ ] GroupsPage → same pattern
- [ ] EntityDesigner → same pattern
- [ ] Each verified after migration

### Step 5.4 — Migrate FormPage

- [ ] FormPage → same pattern (metadata-driven columns + form body)
- [ ] Verified

### Step 5.5 — Delete CrudPage

- [ ] Delete `src/components/crud-page/CrudPage.tsx`
- [ ] Remove all imports
- [x] TypeScript clean

---

## Phase 6: Replace ChildGrid with DataGrid + CrudPanel

### Step 6.1 — Wire DataGrid into child tabs

- [ ] Remove ChildGrid import from FormDetailTabs
- [ ] Add DataGrid with `table` prop + `parentFilter` for child table FK
- [ ] DataGrid handles sorting, search, pagination automatically

### Step 6.2 — Wire CrudPanel into child tabs (SlidePanel container)

- [ ] useLink connects child DataGrid to child CrudPanel
- [ ] SlidePanel contains child CrudPanel
- [ ] `savePayloadExtras` includes parent FK
- [ ] Child CrudPanel auto-registers with parent via CrudPanelContext
- [ ] Dirty cascade works: switching parent row checks child CrudPanel

### Step 6.3 — Delete ChildGrid.tsx

- [ ] Delete `src/components/pages/FormPage/ChildGrid.tsx`
- [ ] Remove all imports
- [x] TypeScript clean

### Step 6.4 — Verify child table operations

- [ ] Browse: sorting, search, pagination
- [ ] CRUD: create (with parent FK), edit, delete, copy
- [ ] Notes and Audit on child records
- [ ] Dirty cascade: switch parent with dirty child → guard fires
- [ ] Parent has no children → empty state

---

## Phase 7: Design Mode Cleanup

### Step 7.1 — Grid Column Designer owned by DataGrid

- [ ] DataGrid accepts `isAdmin` prop
- [ ] Shows "Grid Cols" button when admin
- [ ] Works on main and child DataGrids

### Step 7.2 — Field Layout Designer owned by CrudPanel

- [ ] CrudPanel accepts `isAdmin` + `formKey` props
- [ ] Manages design state internally
- [ ] Works on main and child CrudPanels

### Step 7.3 — Remove design mode from FormPage

- [ ] FormPage just passes `isAdmin` and `formKey`
- [x] TypeScript clean

---

## Phase 8: Polish & Documentation

### Step 8.1 — Update ARCHITECTURE.md

- [ ] Document Panel hierarchy
- [ ] Document useLink publisher/consumer pattern
- [ ] Document page composition pattern
- [ ] Add examples: simple page, tabbed page, child tables

### Step 8.2 — Clean up

- [ ] Remove dead imports everywhere
- [ ] Final TypeScript + lint check

---

## Decision Log

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Who owns beforeunload? | CrudPanel | It knows if form is dirty |
| 2 | Who fetches colTypes/colScales? | Each component fetches its own | Components own their concerns |
| 3 | Who renders empty state? | CrudPanel via renderEmpty prop | Consistent everywhere |
| 4 | Who owns mobile layout? | Page file (parent) | Layout concern |
| 5 | Who owns grid col designer? | DataGrid | Grid display concern |
| 6 | Who owns field designer? | CrudPanel | Form display concern |
| 7 | Is there a CrudPage? | No. Pages compose directly. | No abstraction layer needed |
| 8 | Panel base? | Stub for now | CrudPanel + InquiryPanel inherit |
| 9 | Dirty cascade? | canRelease() + CrudPanelContext | Recursive, any depth |
| 10 | Who builds fetchPage? | DataGrid from its table prop | Identical for every table |
| 11 | Who builds empty row? | CrudPanel from schema + defaultValues | Page just passes defaults |
| 12 | How do siblings coordinate? | useLink hook — generic publisher/consumer | Component-agnostic |
| 13 | What does DataGrid send on select? | oid + full row | Consumer shouldn't re-fetch |
| 14 | What is Page? | AppShell wrapper with content slot | Knows nothing about data or CRUD |
