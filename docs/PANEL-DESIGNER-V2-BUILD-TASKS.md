# Panel Designer v2 Build Tasks

> Execution checklist for implementing the v2 Panel Designer.
> Companion to `PANEL-DESIGNER-V2-TECH-SPEC.md`.
> This plan is intentionally phased so the app remains working if development pauses after any phase.

---

## Current Status

Completed in the current module:
- [x] Phase 1 - Persistence Foundation
- [x] Phase 2 - Panel Layout API
- [x] Phase 3 - Runtime Loader (No Visual Changes)
- [x] Phase 4 - Design Mode Shell
- [x] Phase 5 - Field Properties Drawer (Existing Fields Only)
- [x] Phase 6 - Tab and Section Drawers
- [x] Phase 7 - Add Existing Datasource Fields
- [x] Phase 8 - Backend Custom Field Contract
- [x] Phase 9 - Add Custom Field Drawer
- [x] Phase 10 - Reorder / Move Operations

Still open or intentionally deferred:
- [ ] Phase 11 - Child Grids As Structural Elements
- [ ] Phase 12 - Hardening and Testing
- [ ] Translation-aware designer labels (tracked separately)
- [ ] Destructive custom-field purge workflow for dev cleanup (tracked separately)

The core panel-designer module is usable and working in dev. This checklist remains because there is still deferred cleanup/hardening work.

---

## Delivery Rules

- Each phase must be a complete vertical slice or a dormant infrastructure change.
- Normal runtime behavior must remain unchanged unless the feature is explicitly activated.
- Prefer page-scoped rollout first, then widen once stable.
- No phase should require unfinished downstream work to keep the app working.
- If a phase introduces persistence, zero persisted rows must be a safe no-op.
- Once panel-designer implementation starts, do not create intermediate commits for partial phases; commit only when the module checkpoint is intentionally complete and stable.

---

## Phase 1 - Persistence Foundation

### Goal
Add a dormant persistence layer for panel designer data without changing any live panel behavior.

### Scope
- [ ] Create `panel_layout` table
- [ ] Add primary key / unique key strategy
- [ ] Add timestamps
- [ ] Add `properties jsonb`
- [ ] Add indexes for `form_key`, `panel_key`, `table_name`, `entry_type`
- [ ] Finalize `entry_type` values
- [ ] Finalize scope rules for `domain`
- [ ] Finalize what `panel_key` means in v2
- [ ] Finalize uniqueness rules for `custom_field`
- [ ] Add DB migration or schema note

Suggested logical columns:
- [ ] `oid`
- [ ] `domain`
- [ ] `form_key`
- [ ] `panel_key`
- [ ] `table_name`
- [ ] `entry_type`
- [ ] `entry_key`
- [ ] `parent_key`
- [ ] `sort_order`
- [ ] `properties`
- [ ] `created_at`
- [ ] `updated_at`

### Files Touched
- DB migration / schema note
- docs as needed

### Success Criteria
- [ ] New persistence exists
- [ ] No runtime code depends on it yet
- [ ] Existing screens behave exactly the same

### Rollback Safety
- [ ] Safe to stop here
- [ ] Safe to leave table unused
- [ ] No panel rendering behavior changed

---

## Phase 2 - Panel Layout API

### Goal
Expose persistence through a dedicated API route that is harmless if no consumer uses it.

### Scope
- [ ] Create `src/app/api/panel-layout/route.ts`
- [ ] Implement `GET`
- [ ] Implement `PUT`
- [ ] Implement `DELETE` if needed
- [ ] Validate required keys for each `entry_type`
- [ ] Reject invalid `entry_type`
- [ ] Reject duplicate custom field keys within scope
- [ ] Reject reserved field names
- [ ] Validate supported custom data types
- [ ] Decide whether saves replace the full panel set or upsert individual rows
- [ ] Keep behavior consistent with toolbar-actions where possible

### Files Touched
- `src/app/api/panel-layout/route.ts`
- shared validation helpers if needed

### Success Criteria
- [ ] API can create/read/update layout rows
- [ ] Invalid input is rejected cleanly
- [ ] No live page depends on this route yet

### Rollback Safety
- [ ] Safe to stop here
- [ ] API can exist unused with no runtime effect

---

## Phase 3 - Runtime Loader (No Visual Changes)

### Goal
Load persisted layout data at runtime, but do nothing unless valid rows exist.

### Scope
- [ ] Create `src/platform/core/PanelLayoutRuntime.ts`
- [ ] Load persisted panel layout rows by `form_key` + `panel_key`
- [ ] Normalize rows by `entry_type`
- [ ] Add integration hook in v2 page/panel construction
- [ ] Keep zero-row behavior as a strict no-op
- [ ] Log and skip invalid rows rather than crashing

### Files Touched
- `src/platform/core/PanelLayoutRuntime.ts`
- `src/platform/core/PageDef.ts`
- `src/platform/core/PanelDef.ts`
- any runtime integration helper needed

### Success Criteria
- [ ] Existing pages still build normally with no layout rows
- [ ] Loader can be invoked safely on target page(s)
- [ ] Invalid persisted data does not crash the screen

### Rollback Safety
- [ ] Safe to stop here
- [ ] Runtime hook can remain dormant until rows exist

---

## Phase 4 - Design Mode Shell

### Goal
Add a page-scoped design mode that can inspect/select targets without editing anything yet.

### Scope
- [ ] Add admin-only design toggle to panel UI
- [ ] Prevent accidental editing while in design mode
- [ ] Ensure normal editing mode remains unchanged when design mode is off
- [ ] Tabs show editable affordance in design mode
- [ ] Sections show editable affordance in design mode
- [ ] Fields show editable affordance in design mode
- [ ] Clicking a tab selects it
- [ ] Clicking a section selects it
- [ ] Clicking a field selects it
- [ ] Keep rollout page-scoped initially

### Files Touched
- `src/components/panel/EditPanelRenderer.tsx`
- `src/components/panel/TabRenderer.tsx`
- `src/components/panel/SectionRenderer.tsx`
- `src/components/panel/FieldRenderer.tsx`
- designer state helper(s)

### Success Criteria
- [ ] Design mode can be turned on and off safely
- [ ] Normal edit mode is unchanged when design mode is off
- [ ] Targets are visually selectable in design mode
- [ ] No persistence changes yet

### Rollback Safety
- [ ] Safe to stop here
- [ ] Feature can be hidden behind toggle/page scope

---

## Phase 5 - Field Properties Drawer (Existing Fields Only)

### Goal
Deliver the first complete edit flow using the drawer factory, limited to safe field overrides on fields that already exist.

### Scope
- [ ] Create designer drawer launcher tied to `PageDef` drawer factory
- [ ] Ensure only one designer drawer is active at a time
- [ ] Open field drawer from selected field
- [ ] Edit label
- [ ] Edit hidden flag
- [ ] Edit readOnly flag
- [ ] Edit required flag if supported
- [ ] Persist field override rows
- [ ] Reapply overrides live after save

### Files Touched
- designer drawer files
- `src/platform/core/PageDef.ts`
- `src/platform/core/PanelLayoutRuntime.ts`
- field renderer/runtime integration files

### Success Criteria
- [ ] Existing field can be selected
- [ ] Drawer opens through v2 drawer mechanism
- [ ] Save persists override and updates live panel
- [ ] Page remains functional after refresh

### Rollback Safety
- [ ] Safe to stop here
- [ ] Only existing fields are affected
- [ ] Zero overrides still means base page behavior

---

## Phase 6 - Tab and Section Drawers

### Goal
Expand editing to structural metadata without changing field inventory.

### Scope
- [ ] Tab drawer: edit label
- [ ] Tab drawer: edit icon if supported
- [ ] Tab drawer: reorder
- [ ] Tab drawer: delete if safe
- [ ] Section drawer: edit label
- [ ] Section drawer: edit column count
- [ ] Section drawer: move to tab
- [ ] Section drawer: reorder
- [ ] Section drawer: delete if safe

### Files Touched
- tab/section drawer files
- `src/platform/core/PanelLayoutRuntime.ts`
- panel renderers as needed

### Success Criteria
- [ ] Tab overrides apply live and survive reload
- [ ] Section overrides apply live and survive reload
- [ ] Ordered-child semantics remain intact

### Rollback Safety
- [ ] Safe to stop here
- [ ] No custom field backend work required yet

---

## Phase 7 - Add Existing Datasource Fields

### Goal
Allow placement of fields already known to the datasource, without introducing custom fields yet.

### Scope
- [ ] Extend `DataSourceDef` with merged available field catalog support as needed
- [ ] Build helper to list all available datasource fields
- [ ] Exclude already-placed fields for Add Field UI
- [ ] Create Add Field drawer
- [ ] Show available datasource-backed fields
- [ ] Select target section
- [ ] Save placement row
- [ ] Materialize placed field in runtime object tree

### Files Touched
- `src/platform/core/DataSourceDef.ts`
- `src/platform/core/PanelLayoutRuntime.ts`
- Add Field drawer files

### Success Criteria
- [ ] User can place an existing datasource field onto the panel
- [ ] New placement renders correctly without code changes
- [ ] Existing panel remains stable if no new placements are added

### Rollback Safety
- [ ] Safe to stop here
- [ ] Still no dependency on `custom_fields` JSONB behavior

---

## Phase 8 - Backend Custom Field Contract

### Goal
Teach backend metadata and CRUD layers about custom fields while keeping the base schema intact.

### Scope
- [ ] Identify schema/column metadata endpoints currently used by `DataSourceDef`
- [ ] Merge `custom_field` definitions from panel layout persistence into those responses
- [ ] Include at least `key`, `label`, `dataType`
- [ ] Include renderer hints if available
- [ ] Flatten `custom_fields` JSONB values into normal payload properties on read
- [ ] Detect custom field keys in incoming payload on write
- [ ] Write their values into `custom_fields` JSONB
- [ ] Prevent accidental writes to nonexistent base columns
- [ ] Decide how custom field rename is handled
- [ ] Decide how custom field delete is handled when values already exist

### Files Touched
- metadata/schema API route(s)
- CRUD route layer
- `src/platform/core/DataSourceDef.ts`

### Success Criteria
- [ ] Backend can expose custom fields deterministically
- [ ] Custom field values round-trip through `custom_fields`
- [ ] Base fields remain unaffected

### Rollback Safety
- [ ] Safe to stop here
- [ ] No UI depends on custom field creation yet

---

## Phase 9 - Add Custom Field Drawer

### Goal
Deliver custom field creation end to end, using the same panel-designer persistence as layout overrides.

### Scope
- [ ] Create Add Custom Field drawer
- [ ] Capture field key
- [ ] Capture label
- [ ] Capture data type
- [ ] Persist custom field definition
- [ ] Refresh datasource metadata
- [ ] Optionally place immediately after creation
- [ ] Materialize placed custom fields as runtime `FieldDef`s
- [ ] Ensure custom field renderer/data type defaults are honored

### Files Touched
- Add Custom Field drawer files
- metadata/runtime integration files
- `src/platform/core/PanelLayoutRuntime.ts`

### Success Criteria
- [ ] User can define a custom field from the designer
- [ ] Backend exposes it through metadata
- [ ] Value can be saved via `custom_fields`
- [ ] Field can be placed on the panel and survive reload

### Rollback Safety
- [ ] Safe to stop here
- [ ] Existing base pages still work even if no custom fields are created

---

## Phase 10 - Reorder / Move Operations

### Goal
Add safe structural movement without importing any v1 row/column layout model.

### Scope
- [ ] Reorder tabs by ordered-list semantics
- [ ] Reorder sections within tab
- [ ] Move section across tabs
- [ ] Reorder fields within section
- [ ] Move field across sections
- [ ] Do not introduce v1 row/col cell-placement logic
- [ ] Keep v2 ordered-child semantics intact

### Files Touched
- designer drawers / move helpers
- `src/platform/core/PanelLayoutRuntime.ts`

### Success Criteria
- [ ] Reorder/move operations survive reload
- [ ] Runtime order matches persisted order
- [ ] No v1 placement grid semantics introduced

### Rollback Safety
- [ ] Safe to stop here
- [ ] Movement changes are limited to persisted overrides

---

## Phase 11 - Child Grids As Structural Elements

### Goal
Decide whether child grids participate in designer placement in the first release, without dragging in v1 browse-grid designer scope.

### Scope
- [ ] Decide whether child grids can be placed/removed through panel designer initially
- [ ] If yes, model them as structural layout entries only
- [ ] Do not port v1 browse-grid/grid-column designer behavior into this panel-designer effort

### Files Touched
- runtime/layout integration files if enabled
- drawer files if enabled

### Success Criteria
- [ ] Decision is explicit
- [ ] If implemented, child grids behave as structural nodes only

### Rollback Safety
- [ ] Safe to defer entirely
- [ ] No dependency on this phase for earlier panel designer work

---

## Phase 12 - Hardening and Testing

### Goal
Make the delivered phases durable enough for continued dev use without destabilizing the app.

### Scope
- [ ] Protect against invalid parent references
- [ ] Protect against duplicate sort orders where needed
- [ ] Protect against invalid custom field definitions
- [ ] Add save/cancel flows that preserve a stable runtime panel
- [ ] Add visible errors for failed persistence
- [ ] Add safe fallback if persisted layout is invalid
- [ ] Ensure invalid persisted rows do not crash page construction
- [ ] Log and skip bad layout rows where possible
- [ ] Persistence tests: create/read/update/delete panel layout rows
- [ ] Runtime tests: tab/section/field/custom field override application
- [ ] CRUD tests: `custom_fields` read/write behavior
- [ ] UI tests: design mode toggle, drawer open/save, add field, add custom field

### Files Touched
- test files
- error handling paths
- runtime loader and designer UI as needed

### Success Criteria
- [ ] Earlier phases remain working
- [ ] Failure cases are visible and recoverable
- [ ] Invalid persisted data does not take down a page

### Rollback Safety
- [ ] Safe to pause after any earlier phase even if hardening is incomplete

---

## Recommended Stop Points

- [x] Stop after Phase 1 if you only want schema in place
- [x] Stop after Phase 3 if you want dormant runtime support only
- [x] Stop after Phase 5 for the first usable designer slice
- [x] Stop after Phase 7 for existing-field panel editing without custom fields
- [x] Stop after Phase 9 for full custom-field creation and placement

---

## Non-Goals

- [x] Do not use `form_tables`
- [x] Do not use `form_fields`
- [x] Do not port v1 grid designer logic
- [x] Do not adopt v1 `FormPage` / metadata runtime patterns
- [x] Do not require app-wide activation before the page-scoped slice is stable
