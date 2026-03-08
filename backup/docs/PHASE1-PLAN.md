# Form Platform — Phase 1 Build Plan

> Metadata-driven form engine replacing the iPurchase newmaintv2.p / getsettings.p / ATTRS_ stack.
> Phase 1 covers the core engine — no approval workflow (Phase 2).

---

## Steps

### Step 1 — Metadata Tables & Foundation
Create the 6 metadata tables that power everything: schema layer (Entity Designer) and layout layer (Screen Layout Designer), plus attachment configuration and storage.

### Step 2 — Entity Designer (CRUD Screen)
Admin screen for creating forms, designing tables, adding fields, and defining relationships. Built as a standard CrudPage using the existing factory pattern. Writes to `forms`, `form_tables`, `form_fields`.

### Step 3 — Schema Generation Engine
The "Generate" button logic. Diffs metadata (`form_fields`) vs actual database (`information_schema`) and emits incremental DDL: CREATE TABLE, ALTER TABLE ADD/ALTER/DROP COLUMN, CREATE/DROP INDEX. Adds standard fields (oid, domain, audit columns, custom_fields, copied_from) automatically.

### Step 4 — CrudRoute Class & FormPage Engine
New class-based runtime for generated forms. `CrudRoute` (class) reads `form_fields` metadata for CRUD operations. `FormPage` reads `form_layout` metadata and renders tabs → sections → fields → child grids. Includes the stacking slide-in panel system for child record editing. Coexists with the existing `createCrudRoutes()` factory for hand-coded pages.

### Step 5 — File Generation & Menu Integration
Generate button also creates the 4 files per form (src page.tsx, src route.ts, customer page.tsx, customer route.ts) + default `form_layout` rows (one General tab, sections, all fields placed with default renderers, grid columns for child tables) + menu entry. Files are created once and never regenerated.

### Step 6 — Screen Layout Designer (Design Mode)
Gear/pencil icon overlay on running FormPage. Admins enter design mode, click tabs/sections/fields to edit properties via slide-in panels. Manages field placement, renderers, renderer props, col-span, mandatory/read-only rules, searchable flags. Writes to `form_layout` with domain scoping (* wildcard + specific domain overrides).

### Step 7 — Copy Support
Copy button on all generated forms. Clones header + all children/grandchildren with new oids, re-pointed FKs, cleared non-copyable fields, reset audit fields. Sets `copied_from` = source oid. Respects `is_copyable` flag per field from `form_fields`.

### Step 8 — Attachments
Two mechanisms: attachment fields (named, specific-purpose documents inline on the form) and attachment tabs (generic collections with configurable types). Security per type (view/upload/delete access). Header attachment tab rolls up all children. Uses `platform_attachment_types` + `platform_attachments` tables from Step 1.

---

## Step 1 — Detailed Tasks

### 1.1 ✅ Create migration script `012_form_platform.py`

New migration following existing conventions (Python, idempotent, psycopg2).

### 1.2 ✅ Create `forms` table

Form registration — one row per form in the system.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| form_key | citext NOT NULL UNIQUE | slug: "suppliers", "requisitions" |
| form_name | citext NOT NULL DEFAULT '' | display name |
| description | citext NOT NULL DEFAULT '' | |
| has_approvals | boolean NOT NULL DEFAULT false | Phase 2 — controls which base class generated files extend |
| has_attachments | boolean NOT NULL DEFAULT false | enables attachment tabs |
| is_generated | boolean NOT NULL DEFAULT false | has Generate been run at least once? |
| menu_category | citext NOT NULL DEFAULT '' | which sidebar group to place in |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Index: `form_key` (covered by UNIQUE).

### 1.3 ✅ Create `form_tables` table

Tables within a form — header + children. One row per table.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| form_key | citext NOT NULL | FK to forms.form_key |
| table_name | citext NOT NULL | PG table name |
| is_header | boolean NOT NULL DEFAULT false | one header per form |
| parent_table | citext NOT NULL DEFAULT '' | empty for header, parent table_name for children |
| tab_label | citext NOT NULL DEFAULT '' | display name for child tab |
| sort_order | integer NOT NULL DEFAULT 0 | child tab display order |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Constraints: UNIQUE(form_key, table_name).
Index: `form_key`.

### 1.4 ✅ Create `form_fields` table

Field definitions — one row per column per table. Drives DDL generation.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| form_key | citext NOT NULL | |
| table_name | citext NOT NULL | |
| field_name | citext NOT NULL | PG column name |
| data_type | citext NOT NULL DEFAULT 'text' | text, integer, numeric, boolean, date, timestamptz, uuid, attachment, jsonb |
| max_length | integer | for text |
| precision | integer | for numeric |
| scale | integer | for numeric |
| is_nullable | boolean NOT NULL DEFAULT true | |
| default_value | citext NOT NULL DEFAULT '' | SQL default expression |
| is_indexed | boolean NOT NULL DEFAULT false | |
| is_unique | boolean NOT NULL DEFAULT false | |
| is_copyable | boolean NOT NULL DEFAULT true | included when copying records |
| sort_order | integer NOT NULL DEFAULT 0 | field creation order |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Constraints: UNIQUE(form_key, table_name, field_name). FK(form_key, table_name) → form_tables(form_key, table_name).
Index: `(form_key, table_name)`.

### 1.5 ✅ Create `form_layout` table

Single table for all UI layout elements — tabs, sections, fields, grid columns. Per-domain with wildcard defaults.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| domain | citext NOT NULL DEFAULT '*' | * = all domains, or specific |
| form_key | citext NOT NULL | FK to forms.form_key |
| table_name | citext NOT NULL DEFAULT '' | which table (for child tabs, fields, grid columns) |
| layout_type | citext NOT NULL | 'tab', 'section', 'field', 'grid_column' |
| layout_key | citext NOT NULL | tab key, section key, field_name |
| parent_key | citext NOT NULL DEFAULT '' | field → section, section → tab, tab → empty |
| sort_order | integer NOT NULL DEFAULT 0 | |
| properties | jsonb NOT NULL DEFAULT '{}' | type-specific attributes (label, renderer, col_span, etc.) |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Constraints: UNIQUE(domain, form_key, layout_type, table_name, layout_key).
Index: `(form_key, domain, layout_type)`.

### 1.6 ✅ Create `platform_attachment_types` table

Attachment type definitions with security — per form, per table.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| domain | citext NOT NULL DEFAULT '*' | |
| form_key | citext NOT NULL | FK to forms.form_key |
| table_name | citext NOT NULL | which table (header or child) |
| source | citext NOT NULL DEFAULT 'tab' | 'field' or 'tab' |
| type_code | citext NOT NULL | "w9", "internal", "external" |
| type_label | citext NOT NULL DEFAULT '' | display name |
| max_count | integer | null = unlimited, 1 = single file |
| mandatory | citext NOT NULL DEFAULT 'never' | never / always / before_submit |
| accept | citext NOT NULL DEFAULT '' | allowed MIME types: ".pdf,.jpg,.png" |
| view_access | citext NOT NULL DEFAULT '*' | users/groups who can view |
| upload_access | citext NOT NULL DEFAULT '*' | users/groups who can upload |
| delete_access | citext NOT NULL DEFAULT '*' | users/groups who can delete |
| print_on_output | boolean NOT NULL DEFAULT false | |
| sort_order | integer NOT NULL DEFAULT 0 | |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Constraints: UNIQUE(domain, form_key, table_name, type_code).

### 1.7 ✅ Create `platform_attachments` table

Actual file storage — shared by attachment fields and attachment tabs across all forms.

| Column | Type | Notes |
|--------|------|-------|
| oid | uuid PK | standard |
| domain | citext NOT NULL | |
| entity_type | citext NOT NULL | table name |
| entity_oid | uuid NOT NULL | record oid |
| attachment_type | citext NOT NULL | type_code from platform_attachment_types |
| file_name | citext NOT NULL DEFAULT '' | original filename |
| file_type | citext NOT NULL DEFAULT '' | MIME type |
| file_size | bigint NOT NULL DEFAULT 0 | bytes |
| file_data | bytea | binary content |
| description | citext NOT NULL DEFAULT '' | |
| created_at | timestamptz NOT NULL DEFAULT now() | standard |
| created_by | text NOT NULL DEFAULT '' | standard |
| updated_at | timestamptz NOT NULL DEFAULT now() | standard |
| updated_by | text NOT NULL DEFAULT '' | standard |

Indexes: `(domain, entity_type, entity_oid)`, `(domain, entity_type, attachment_type)`.

### 1.8 ✅ Add `set_updated_at` triggers

Create trigger function + trigger for each of the 6 tables. Same pattern as existing tables.

### 1.9 ✅ Add audit trail triggers

Add all 6 tables to `AUDITED_TABLES` in `003_audit_log.py` and re-run. Tables to add: `forms`, `form_tables`, `form_fields`, `form_layout`, `platform_attachment_types`, `platform_attachments`.

### 1.10 ✅ Add column comments

`COMMENT ON COLUMN` for all business columns on all 6 tables — future i18n labels.

### 1.11 ✅ Verify

- Run migration: `python3 scripts/migrate/012_form_platform.py`
- Re-run audit: `python3 scripts/migrate/003_audit_log.py`
- Verify all 6 tables exist with correct columns
- Verify triggers fire (insert + update a row, check audit_log)

---

## Step 2 — Detailed Tasks

The Entity Designer is an admin screen for creating forms and designing their schema (tables + fields). It's built as a standard CrudPage using the existing factory pattern — it reads/writes the metadata tables from Step 1. The "Generate" button (Step 3) will be added to this screen later.

### 2.1 ✅ API route: `forms`

`src/app/api/forms/route.ts` using `createCrudRoutes()`.

Columns: form_key, form_name, description, has_approvals, has_attachments, is_generated, menu_category.
Required: form_key, form_name.
Default sort: form_key.
Search: form_key, form_name, description.
Unique error: form_key.

Note: `forms` is a global table (no domain column) — only ISS admins use the Entity Designer.

### 2.2 ✅ API route: `form_tables`

`src/app/api/form_tables/route.ts` using `createCrudRoutes()`.

Columns: form_key, table_name, is_header, parent_table, tab_label, sort_order.
Required: form_key, table_name.
Default sort: sort_order, table_name.
Search: table_name, tab_label.
Unique error: table_name within form.
Filter support: form_key (parent filter from the UI).

### 2.3 ✅ API route: `form_fields`

`src/app/api/form_fields/route.ts` using `createCrudRoutes()`.

Columns: form_key, table_name, field_name, data_type, max_length, precision, scale, is_nullable, default_value, is_indexed, is_unique, is_copyable, sort_order.
Required: form_key, table_name, field_name.
Default sort: sort_order, field_name.
Search: field_name.
Unique error: field_name within table.
Filter support: form_key + table_name (parent filter from the UI).

### 2.4 ✅ Entity Designer page shell

`src/components/pages/EntityDesigner.tsx` — CrudPage for `forms` with `renderTabs`.

Browse grid columns: form_key, form_name, has_approvals, has_attachments, is_generated.
Detail view: tabbed layout with General, Tables, and Fields tabs.

### 2.5 ✅ General tab

Form header fields using existing `useFieldHelper` pattern:
- form_key (read-only after create)
- form_name
- description
- has_approvals (checkbox)
- has_attachments (checkbox)
- menu_category (text or dropdown)
- is_generated (read-only badge/indicator, not editable)

### 2.6 ✅ Tables tab

Custom component showing tables in the current form. Similar pattern to GroupsPage's MembersTab.

Features:
- DataGrid or list of tables filtered by current form_key
- Add Table: inline form or modal — enter table_name, is_header toggle, parent_table dropdown (populated from existing tables in this form), tab_label, sort_order
- Edit table properties inline or via row click
- Delete table (with cascade warning — deletes all fields too)
- Validation: exactly one header table per form, parent_table must reference a valid table in the same form
- Auto-convention: when adding a child table with parent_table set, auto-create the `oid_<parent_table>` FK field in form_fields

### 2.7 ✅ Fields tab

Custom component for managing fields on a selected table.

Features:
- Table selector dropdown at top (populated from form_tables for this form)
- DataGrid of fields for the selected table, filtered by form_key + table_name
- Add Field: field_name, data_type (dropdown: text, integer, numeric, boolean, date, timestamptz, uuid, jsonb), max_length, precision, scale, is_nullable, default_value, is_indexed, is_unique, is_copyable, sort_order
- Edit field properties via row click or inline
- Delete field (with confirmation — will DROP COLUMN on next generate)
- Read-only display of standard fields (oid, domain, audit columns, custom_fields, copied_from) — shown but not editable/deletable, clearly marked as "auto-managed"
- Drag-to-reorder or manual sort_order editing

### 2.8 ✅ Menu entry

Add "Entity Designer" to the sidebar menu under an "Admin" or "Platform" category. Wire the page component into the navigation system following existing patterns.

### 2.9 ✅ Validation rules

Enforce in both API routes and UI:
- form_key: lowercase, no spaces, valid PG identifier (letters, digits, underscores)
- table_name: same rules as form_key
- field_name: same rules, plus cannot be a standard field name (oid, domain, created_at, created_by, updated_at, updated_by, custom_fields, copied_from)
- data_type: must be from allowed list
- max_length: required when data_type = text (or default to unbounded)
- precision/scale: required when data_type = numeric
- One and only one is_header = true per form
- parent_table references must be valid within the same form
- No circular parent_table references

---

## Step 2 — Completion Summary

**All 9 tasks completed.**

Files created:
- `src/app/api/forms/route.ts` — createCrudRoutes for forms table (10 lines)
- `src/app/api/form_tables/route.ts` — createCrudRoutes for form_tables table (10 lines)
- `src/app/api/form_fields/route.ts` — createCrudRoutes for form_fields table (10 lines)
- `src/components/pages/EntityDesigner.tsx` — Full Entity Designer page (672 lines)

Files modified:
- `src/components/shell/AppShell.tsx` — Added Platform nav section with Entity Designer menu item
- `src/app/page.tsx` — Added EntityDesigner import + routing block

Features delivered:
- CrudPage browse grid: form_key, form_name, has_approvals, has_attachments, is_generated
- General tab: form_key (read-only after create), form_name, description, has_approvals, has_attachments, menu_category, is_generated badge
- Tables tab: CRUD for tables within form, header/child types, parent_table dropdown, auto-creates oid_<parent> FK field for child tables, cascade delete warning
- Fields tab: table selector dropdown, CRUD for fields, data_type-aware form (text→max_length, numeric→precision/scale), toggles for nullable/indexed/unique/copyable, standard fields info box
- Client-side validation: PG identifier rules, one-header-per-form, no self-parent, reserved field names blocked, data type required
- Sort order on tables and fields for ordering control

## Step 3 — Detailed Tasks

### 3.1 ✅ API endpoint `/api/forms/generate/route.ts`
POST endpoint accepting `{ form_key }`. Orchestrates the full generation pipeline: read metadata, diff against DB, build DDL, execute, update `is_generated`.

### 3.2 ✅ Schema diff engine (`lib/schema-generator.ts`)
Core library that:
- Reads `form_tables` + `form_fields` metadata for the given form
- Reads `information_schema.columns`, `information_schema.tables`, and `pg_indexes` for what exists
- Produces a list of DDL operations (create table, add column, alter column, add/drop index, warnings)

### 3.3 ✅ DDL: CREATE TABLE for new tables
Standard fields auto-added to every table:
- `oid uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `domain citext NOT NULL DEFAULT ''`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `created_by citext NOT NULL DEFAULT ''`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `updated_by citext NOT NULL DEFAULT ''`
- `custom_fields jsonb NOT NULL DEFAULT '{}'`

Header-only fields:
- `copied_from uuid` (nullable)

Approval fields (header only, when has_approvals = true):
- `status citext NOT NULL DEFAULT ''`
- `submitted_by citext NOT NULL DEFAULT ''`
- `submitted_at timestamptz`
- `approved_at timestamptz`
- `approved_by citext NOT NULL DEFAULT ''`
- `is_change_order boolean NOT NULL DEFAULT false`

Child tables get `oid_<parent> uuid NOT NULL` with FK constraint + index.

Custom fields: text → citext (unless case_sensitive), numeric with precision/scale, etc.

### 3.4 ✅ DDL: ALTER TABLE for existing tables
- New fields → `ALTER TABLE ADD COLUMN`
- Type changes → `ALTER TABLE ALTER COLUMN TYPE` (with safety warnings for lossy changes)
- Removed fields → Warning only, no auto-drop. Listed in output as "field X in DB but not in metadata"

### 3.5 ✅ DDL: Indexes
- `is_indexed` → `CREATE INDEX IF NOT EXISTS idx_<table>_<field>`
- `is_unique` → `CREATE UNIQUE INDEX IF NOT EXISTS uidx_<table>_<field>`
- Index removed in metadata → `DROP INDEX IF EXISTS`
- Standard indexes: domain on every table, oid_<parent> on child tables

### 3.6 ✅ DDL: Triggers
- `set_updated_at` trigger on each new table (same pattern as existing tables)

### 3.7 ✅ Generate button on Entity Designer
- Button on General tab (disabled if no tables/fields defined)
- Calls generate endpoint
- Shows DDL preview before executing (confirm dialog)
- Displays success/error results

### 3.8 ✅ Set `is_generated = true` after success

### 3.9 ✅ Test with POReq form

## Step 3 — Detailed Tasks

### 3.1 ✅ Schema generator library (`src/lib/schema-generator.ts`)
Reads form_tables + form_fields metadata, queries information_schema for existing DB state, produces DdlOp array. Handles: CREATE TABLE (standard fields, header-only fields, approval fields, FK fields, custom fields), ALTER TABLE ADD/DROP COLUMN, type change detection, index CREATE/DROP, trigger creation, orphaned column warnings.

### 3.2 ✅ Generate API endpoint (`/api/forms/generate/route.ts`)
POST endpoint accepting form_key + preview flag. Preview mode returns ops without executing. Execute mode runs DDL and sets is_generated=true on success.

### 3.3 ✅ Generate button on Entity Designer
General tab shows "Generate Schema" / "Re-generate Schema" button. Preview dialog shows DDL ops before execution. Results displayed after execution.

### 3.4 ✅ Standard field definitions
Every table: oid, domain, created_at, created_by, updated_at, updated_by, custom_fields. Header only: copied_from. Approval-enabled headers: status, submitted_by, submitted_at, approved_at, approved_by, is_change_order.

### 3.5 ✅ Data type mapping
text → citext (case_sensitive=false) or varchar/text (case_sensitive=true). Full mapping for integer, numeric, boolean, date, timestamptz, uuid, jsonb.

### 3.6 ✅ Tested all scenarios
Fresh create (15 ops, 0 errors), idempotent re-run (0 ops), incremental add column + index, orphaned column warning.

## Step 3 — Completion Summary

All schema generation tasks complete. Generator produces incremental DDL, handles fresh and existing tables, creates proper indexes/triggers/FK constraints. Tested end-to-end with POReq form (requisition + requisition_lines).

---

## Step 3 — Additional Refinements (post-completion)

### 3.7 ✅ CHECK constraints for citext max_length
citext doesn't support `varchar(N)` natively. Generator now emits `CHECK (length(field) <= N)` constraints for citext fields with max_length. Diff engine detects constraint changes and emits single-statement DROP + ADD. Naming convention: `chk_<table>_<field>_len`.

### 3.8 ✅ Dirty tracking (`needs_generate` flag)
- Added `needs_generate boolean` column on `forms` table
- DB triggers on `form_tables` and `form_fields` auto-set `needs_generate = true` when metadata changes
- Generate endpoint clears `needs_generate = false` on success
- Browse grid: custom render shows "Out of Sync" (warning) / "Generated" (success) / "—" badges
- Detail view: amber banner above tabs when dirty, visible from any tab
- Fields tab: "New" / "Modified" badges on individual fields based on `created_at`/`updated_at` vs `last_generated_at`

### 3.9 ✅ Schema generation UX improvements
- Preview returning 0 ops shows "Schema is up to date" message
- Execute success updates `last_generated_at` on row client-side
- `case_sensitive` toggle on text fields (citext vs varchar/text)
- `has_attachments` moved from forms to form_tables (per-table)

---

## Step 4 — Detailed Tasks

The runtime engine that makes generated forms actually work. Two components:
- **CrudRoute** — class-based API handler that reads form_fields metadata to handle CRUD dynamically
- **FormPage** — generic React component that reads form_layout metadata to render the full form

### 4.1 Create `form_layout` default generator
When "Generate" runs for the first time (or when new fields are added), auto-populate `form_layout` rows:
- One "General" tab per table
- One "Details" section inside each tab
- All custom fields placed inside the section with default renderers + sort_order
- Child tables get grid_column entries for their fields
- Only inserts missing layout rows — never overwrites existing customizations

### 4.2 CrudRoute class (`src/lib/crud-route-dynamic.ts`)
Class that reads `form_fields` + `form_tables` metadata at startup and provides:
- `GET` — list with filters, sorting, pagination, search (same contract as createCrudRoutes)
- `GET ?oid=` — single record fetch
- `POST` — insert with column validation from metadata
- `PUT` — update with column validation from metadata
- `DELETE` — soft or hard delete
- Domain filtering enforced on every query
- Standard audit columns auto-populated (created_by, updated_by from session)
- Returns child record counts for header queries (for grid display)

### 4.3 Dynamic API route (`src/app/api/f/[formKey]/route.ts`)
Single catch-all route that instantiates CrudRoute for any form_key. No per-form route files needed at runtime — one route serves all generated forms.

### 4.4 FormPage component (`src/components/pages/FormPage.tsx`)
Generic form renderer that:
- Accepts `formKey` prop
- Fetches `form_layout` metadata (tabs, sections, fields, grid_columns) on mount
- Renders CrudPage-compatible structure: browse grid + detail view
- Browse grid columns derived from grid_column layout entries
- Detail tabs/sections/fields derived from tab/section/field layout entries
- Field renderers chosen by `form_layout.properties.renderer` (text, number, checkbox, date, select, textarea, etc.)
- Respects col_span, mandatory, read-only from layout properties

### 4.5 Child table support in FormPage
- Child tables render as tabs with embedded DataGrid
- Click row → stacking slide-in panel for child record editing
- Panel loads child form layout (sections + fields for that table)
- Add/delete child records inline
- FK (oid_<parent>) auto-populated on child record creation

### 4.6 Dynamic page route (`src/app/f/[formKey]/page.tsx`)
Catch-all Next.js page that renders `<FormPage formKey={params.formKey} />`. One page serves all generated forms.

### 4.7 Menu integration
Generate button also inserts a menu entry into the sidebar (using `menu_category` from forms table). Dynamic forms appear under their configured category.

### 4.8 Field renderer registry
Map of renderer name → React component:
- `text` → Input (default for text/citext)
- `textarea` → multi-line input
- `number` → NumberInput (for integer/numeric)
- `checkbox` → Toggle (for boolean)
- `date` → DatePicker (for date)
- `datetime` → DatePicker with time (for timestamptz)
- `select` → Select dropdown (for fields with options in layout properties)
- `readonly` → read-only display

### 4.9 Test with POReq form
- Generate default layout for POReq
- Navigate to /f/POReq → see working form
- Create a requisition record
- Add line items via child grid
- Edit, save, delete — full CRUD cycle
