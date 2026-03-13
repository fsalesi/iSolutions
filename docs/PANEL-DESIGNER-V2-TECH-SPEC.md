# Panel Designer v2 Tech Spec

> Purpose: define the v2-native Panel Designer for iSolutions.
> This document inventories the feature set that must be rebuilt from the old system, while explicitly avoiding v1 runtime patterns.

---

## Goals

The Panel Designer v2 will allow an admin to modify the live edit-panel layout for a page at runtime.

It must support:
- entering design mode on a live panel
- editing tabs, sections, and fields in place
- adding tabs, sections, and fields
- creating custom fields from the designer
- persisting panel overrides and custom-field definitions
- exposing custom fields through backend metadata so `DataSourceDef` can see them
- storing custom field values in `custom_fields` JSONB on the record
- applying saved overrides onto the v2 object tree at runtime
- opening all designer property editors through the v2 drawer system

It must not depend on v1 runtime form architecture.

---

## Explicit Non-Goals

The v2 Panel Designer must NOT:
- use `CrudPage`, `FormPage`, `SplitCrudPage`, or other backup/v1 runtime patterns
- depend on `form_tables` or `form_fields`
- carry over v1 grid-layout/cell-placement logic
- rely on scanning `custom_fields` JSONB row content to infer schema
- introduce a second metadata system if panel-designer persistence can already hold the needed definitions
- be committed in partial implementation slices once active build work starts; keep panel-designer code changes local until the module is complete and stable

---

## Current v2 Context

v2 runtime forms are class-tree based:
- `PageDef`
- `PanelDef`
- `TabDef`
- `SectionDef`
- `FieldDef`
- `DataGridDef`
- `ToolbarDef`

The designer must operate against that object model.

Important v2 note:
- `PageDef` has the drawer/dynamic-panel factory mechanism used to open dynamic right-side panels
- designer property editors must use that mechanism rather than ad hoc modal or v1 slide-panel wiring

---

## What Must Be Rebuilt

### 1. Design Mode

A page/panel must support an admin-only design mode toggle.

When design mode is active:
- tabs become editable targets
- sections become editable targets
- fields become editable targets
- add-tab / add-section / add-field affordances appear
- normal editing should be suppressed where necessary so clicks target designer actions

Design mode is an overlay on the real panel, not a separate editor screen.

### 2. Tab Editing

Required actions:
- edit tab label
- edit tab icon if tabs support icons
- reorder tabs
- delete tab
- add tab

Open question:
- whether deleting a tab should move its children to an unplaced state or require reassignment first

### 3. Section Editing

Required actions:
- edit section label
- edit section properties such as column count
- reorder sections within a tab
- move section to another tab
- delete section
- add section

### 4. Field Editing

Required actions:
- edit field label
- choose renderer
- edit renderer-specific options
- placeholder/help/default value
- hidden/required/readOnly style flags
- reorder field within section
- move field to another section
- delete field from layout
- add field from available field catalog

Field deletion here means remove from panel layout, not delete from data storage.

### 5. Add Field

Add Field must work from an available-field catalog composed of:
- datasource-backed fields the page can already access
- custom fields defined through designer persistence

Any datasource field not currently placed on the panel can be added.
Any custom field definition not currently placed on the panel can be added.

### 6. Custom Field Creation

The designer must support creating a custom field definition.

Minimum required attributes:
- field key
- label
- data type

Likely future attributes:
- renderer default
- default value
- lookup configuration
- help text
- required/readOnly defaults

Creating a custom field must:
- persist the definition in panel-designer persistence
- make that field visible to backend metadata/schema generation
- allow the datasource to expose it like a normal field
- store the record-level value in `custom_fields` JSONB

### 7. Runtime Override Application

Saved designer data must be applied onto the page's v2 object tree at runtime.

That includes:
- tab overrides
- section overrides
- field overrides
- custom field placements
- custom field definitions merged into the available field catalog

This should happen as a v2 runtime overlay on top of product/customer code definitions.

### 8. Child Grids As Structural Elements

Child grids should be supported as panel children where appropriate, but the old v1 grid-layout-designer logic is out of scope.

For panel designer purposes, child grids are structural elements that can be:
- placed
- moved
- hidden/shown
- configured at a panel level if needed later

This spec does not include porting v1 browse-grid design behavior.

---

## Persistence Model

The panel designer needs a persistent metadata store for:
- tab definitions/overrides
- section definitions/overrides
- field placements/overrides
- custom field definitions

The same persistence layer should also be the source of truth for custom field attributes.

### Required Principle

Do not infer custom field definitions from `custom_fields` JSONB row values.

Instead:
- custom field definitions live in designer persistence
- custom field values live in each row's `custom_fields` JSONB

### Why

This gives:
- deterministic schema
- stable labels and datatypes
- consistent datasource metadata
- clean add/remove/rename lifecycle
- no data-scanning to determine schema

### Persistence Shape

Exact table design is still open, but the persistence model must distinguish between at least two concepts:
- layout entries
- custom field definitions

They may live in:
- one table with typed rows
- one table with JSONB payloads
- or one root JSONB document per panel/form

But both concepts must be represented explicitly.

### Suggested Logical Entities

#### Panel Layout Entry

Represents one item in the panel structure.

Examples:
- tab
- section
- field placement
- child grid placement

Likely attributes:
- domain or scope
- form/page key
- panel key
- entry type
- entry key
- parent key
- sort order
- properties JSONB

#### Custom Field Definition

Represents the definition of a field not present in the underlying base datasource.

Likely attributes:
- domain or scope
- form/page key and/or table key
- field key
- label
- data type
- renderer default
- property metadata JSONB

---


## Phase 1 Schema Decision

### Decision
Use the v2 `panel_layout` table for panel-designer persistence.

Do not reintroduce or depend on `form_layout`.

### Why
- `form_layout` was a v1-era metadata table and has been removed from the active iSolutions database.
- the v2 designer needs ordered structural entries, not cell-based placement.
- `panel_layout` already matches the current v2 runtime and custom-field path.

### Existing Tables Relevant To This Decision
- `panel_layout` is the active v2 persistence table.
- `forms` remains available for future reuse.
- `form_tables`, `form_fields`, and `form_layout` are no longer part of the active schema.

`form_toolbar_actions` currently demonstrates the newer pattern we should mirror:
- explicit key columns
- `settings jsonb not null default '{}'::jsonb`
- simple replace-all API semantics

### Recommended `panel_layout` Table
```sql
create table public.panel_layout (
  oid uuid primary key default gen_random_uuid(),
  domain citext not null default '*'::citext,
  form_key text not null,
  panel_key text not null,
  table_name text not null,
  entry_type text not null,
  entry_key text not null,
  parent_key text not null default '',
  sort_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
```

### Recommended Constraints
```sql
create unique index panel_layout_scope_entry_uq
  on public.panel_layout (domain, form_key, panel_key, table_name, entry_type, entry_key);

create index panel_layout_lookup_idx
  on public.panel_layout (form_key, panel_key, table_name, domain, entry_type, sort_order);
```

### Recommended `entry_type` Values
- `tab`
- `section`
- `field`
- `custom_field`
- `child_grid`

### Column Semantics
- `domain`: follow the same pattern as existing metadata tables; default `'*'`.
- `form_key`: page/form identifier, consistent with current APIs.
- `panel_key`: explicit panel identity in v2 so a page can eventually persist multiple panels cleanly.
- `table_name`: datasource table context.
- `entry_type`: logical node type.
- `entry_key`: stable key for the node or definition.
- `parent_key`: owning node key. Empty string is valid for top-level entries.
- `sort_order`: ordered-child semantics only. No row/col meaning.
- `settings`: all per-entry metadata.

### `settings` Shape By Entry Type
`tab`
```json
{
  "label": "Details",
  "icon": "FileText",
  "hidden": false
}
```

`section`
```json
{
  "label": "Main",
  "columns": 2,
  "hidden": false
}
```

`field`
```json
{
  "label": "Vendor",
  "renderer": "lookup",
  "hidden": false,
  "readOnly": false,
  "required": false,
  "placeholder": "",
  "helpText": ""
}
```

`custom_field`
```json
{
  "label": "Budget Owner",
  "dataType": "text",
  "renderer": "text",
  "transient": false
}
```

`child_grid`
```json
{
  "hidden": false
}
```

### Phase 1 Rules
- Phase 1 creates the table only.
- No runtime should depend on `panel_layout` yet.
- Zero rows must remain a strict no-op.
- No runtime should depend on removed v1 metadata tables.
- `panel_layout` is the only active panel-designer persistence table in v2.


## Backend Responsibilities

The backend must use panel-designer persistence to augment the metadata exposed to the frontend.

### 1. Schema/Column Metadata Augmentation

When the frontend asks for columns/schema/datasource metadata, the backend must merge in custom field definitions from designer persistence.

The merged result must provide enough information for `DataSourceDef` and renderers to know:
- field key
- label
- data type
- any default renderer hints

### 2. CRUD Read/Write Support

The backend must map custom fields to `custom_fields` JSONB when records are fetched or saved.

Expected behavior:
- reads expose custom fields as normal properties in the payload
- writes extract custom-field values from the payload and persist them into `custom_fields` JSONB

This allows the frontend to treat custom fields like normal fields.

### 3. Validation

The backend should validate:
- field key uniqueness within scope
- allowed data types
- reserved-name collisions
- invalid renames/deletes where data migration would be required

---

## Frontend Responsibilities

### 1. Design Mode Overlay

The panel renderer layer must visually expose editable targets without replacing the panel runtime.

### 2. Drawer-Based Property Panels

All property editing UIs must open through the v2 drawer system.

Required drawer panels:
- Tab Properties
- Section Properties
- Field Properties
- Add Tab
- Add Section
- Add Field
- Add Custom Field

### 3. Available Field Catalog

The Add Field UI must show a merged available-field list from:
- datasource fields
- custom field definitions

And exclude fields already placed on the current panel/section where appropriate.

### 4. Runtime Refresh

After a designer save:
- persistence is updated
- runtime panel overrides are reapplied
- the panel refreshes without requiring a full app restart

---

## State Model For Layout

v2 currently thinks in terms of:
- tabs own children
- sections own ordered children
- section column count affects layout flow

This spec deliberately does NOT adopt the v1 row/col placement model.

Therefore the v2 panel designer should preserve the current v2 semantics:
- ordered children within a section
- section-level column count
- optional field span/width behavior if already supported or later added

Reordering should be expressed as ordered-list movement, not cell-based drag/drop coordinates.

---

## Scope Questions To Settle Before Build

### 1. Persistence Scope

Need to define whether panel overrides are scoped by:
- page/form key only
- table key
- customer/product layer
- domain
- user or role overrides later

### 2. Custom Field Scope

Need to define whether a custom field belongs to:
- a table
- a page/form
- both table and page

Recommended default:
- definition belongs to the table/data contract
- placement belongs to the page/panel layout

### 3. Deletion Behavior

Need to define behavior for deleting:
- tab with sections inside it
- section with fields inside it
- custom field definition already placed on panels
- custom field definition with existing stored values in `custom_fields`

### 4. Page Keys / Panel Keys

Need a stable identity for persisted overrides so the backend and runtime know exactly which panel is being customized.

---

## Recommended v2 Build Order

### Phase 1. Persistence + Backend Contract
- define persistence schema
- define custom field definition shape
- merge custom fields into backend metadata/schema responses
- support CRUD read/write through `custom_fields` JSONB

### Phase 2. Runtime Override Engine
- load persisted panel overrides
- apply overrides onto `PanelDef`/`TabDef`/`SectionDef`/`FieldDef`
- expose merged available-field catalog to the designer

### Phase 3. Design Mode Infrastructure
- add admin-only design toggle
- add selection/highlight hooks for tabs/sections/fields
- open drawer panels from `PageDef` drawer factory

### Phase 4. Property Panels
- tab properties
- section properties
- field properties
- add field
- add custom field

### Phase 5. Layout Operations
- reorder tabs
- reorder/move sections
- reorder/move fields
- place/remove child grids as structural elements if needed

### Phase 6. Hardening
- validation rules
- refresh behavior
- protection against invalid overrides
- tests for persistence, runtime application, and CRUD handling of custom fields

---

## What We Are Reusing From v1

Only the feature inventory.

We are NOT reusing:
- v1 runtime form engine
- v1 layout model
- v1 metadata-table assumptions
- v1 grid designer behavior

The only thing carried forward is the list of capabilities the panel designer must provide.

---

## Summary

Panel Designer v2 should be built as a v2-native runtime overlay on the class tree.

Core principles:
- live design mode on the real panel
- drawer-based property editors
- explicit persistence for layout + custom field definitions
- backend schema augmentation from that persistence
- custom field values stored in `custom_fields` JSONB
- no use of `form_tables` or `form_fields`
- no port of v1 implementation patterns
