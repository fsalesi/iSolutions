# 1. Entity Designer

> Design forms as composite entities — one header table plus zero or more child tables. Full schema lifecycle: create, modify, generate. All configuration drives runtime behavior through metadata.

## What Is a Form?

A form is NOT a single table. It is a composite business entity:

- **Header table** — the main record (e.g., Supplier)
- **Child tables** — related records linked to the header (e.g., Addresses, Contacts, Bank Accounts)
- **Grandchild tables** — children of children (e.g., Contacts under an Address)

The form is the unit of design. All tables within a form are managed together.

**Example: Supplier Onboarding**
```
suppliers (header)
  ├── supplier_addresses (child of suppliers)
  │     └── supplier_address_contacts (child of addresses)
  ├── supplier_contacts (child of suppliers)
  └── supplier_bank_accounts (child of suppliers)
```

## Form Creation Workflow

1. Admin navigates to the Form Designer (menu-level access required)
2. Creates a new form — provides a name (used for menu) and optional description
3. Opts into platform services: Approvals (yes/no), Notes, Attachments, etc.
4. Begins designing the header table

## Table Design

### Standard Fields (auto-added to every table)

Every table automatically receives:
- `oid` — UUID primary key
- `domain` — domain/company code
- `created_at` — timestamp
- `created_by` — user ID
- `updated_at` — timestamp
- `updated_by` — user ID
- `custom_fields` — JSONB column for user-defined fields

### Header Table Fields (auto-added to header table only)

Every header table additionally receives:
- `copied_from` — UUID, oid of source record (null if original). Enables copy on any form.

When the form opts into approvals, the header table also receives:
- Standard approval fields: status, submitted_by, submitted_at, approved_at, approved_by, etc.
- `is_change_order` — boolean, true if this modifies an already-approved record

Child tables never get copied_from, is_change_order, or approval fields.

### Custom Fields

The designer allows adding fields with:
- Field name / column name
- Data type (text, number, date, boolean, select, textarea, etc.)
- Label
- Format
- Default value
- Index (yes/no, unique/non-unique)

### Domain Column

Every table automatically gets a `domain` field. This is a standard field like oid and the audit columns — auto-added, not optional.

Domain is NEVER visible on screen and NEVER editable by the user. It is a hidden, system-managed field:
- `FormPage.tsx` — excludes domain from the Screen Layout Designer's available fields. Admins cannot place it on the form.
- `CrudRoute.ts` — on POST, sets domain from session context. On GET/PUT/DELETE, automatically filters by session domain. Cross-domain access is impossible at the engine level.

### Dropping Fields / Tables

TBD — destructive operations need a safety workflow. Confirmation? Soft-delete first?

## Relationships — oid Convention

Child tables are linked to parent tables via an `oid_<parent_table>` foreign key column:

```
supplier_addresses:
  oid                      ← own primary key
  oid_suppliers             ← FK to suppliers.oid
  standard 5 audit fields
  address_type, street1, city, state, zip, ...

supplier_address_contacts:
  oid                      ← own primary key
  oid_supplier_addresses    ← FK to supplier_addresses.oid
  standard 5 audit fields
  name, phone, email, ...
```

The FK column name IS the relationship definition — `oid_suppliers` tells the platform both "this is a foreign key" and "it points to the suppliers table." No separate relationship metadata needed. The platform discovers relationships by scanning for `oid_*` columns.

Automatic filtering:
```
User selects supplier oid = 'abc-123'
  → Addresses tab: WHERE oid_suppliers = 'abc-123'
  
User clicks address oid = 'def-456'
  → Contacts tab: WHERE oid_supplier_addresses = 'def-456'
```

## Schema Generation

### Incremental / Diff-Based

Clicking "Generate Schema" is smart — it diffs what exists in the database vs what's defined in the designer:

- **New table** → CREATE TABLE with all fields, indexes, constraints
- **New field** → ALTER TABLE ADD COLUMN
- **Dropped field** → Confirmation required (destructive). Details TBD.
- **Modified field** → ALTER TABLE ALTER COLUMN (type change, rename, etc.)
- **New index** → CREATE INDEX
- **Dropped index** → DROP INDEX

Can be run as often as needed. Not a drop-and-recreate — always incremental migration.

### Generated Artifacts

**First generate** creates everything:
- `src/app/forms/<form>/page.tsx` — ISS product page (extends FormPage)
- `src/app/forms/<form>/page.customer.tsx` — Customer page shim (extends page.tsx, no overrides)
- `src/app/forms/<form>/route.ts` — ISS product route (extends CrudRoute)
- `src/app/forms/<form>/route.customer.ts` — Customer route shim (extends route.ts, no overrides)
- Same 4 files per child table's CRUD endpoint
- PostgreSQL CREATE TABLE migration for all tables in the form
- Menu entry pointing to `page.customer.tsx` (menu ALWAYS hits the customer version)

**Subsequent generates** only affect the database schema:
- ALTER TABLE ADD/DROP/ALTER COLUMN
- CREATE/DROP INDEX
- The page.tsx, route.ts, and menu entry already exist — never regenerated

### Toggling Approvals After Generation

Changing the approvals flag after the initial generate is a special case that modifies BOTH the database schema AND the generated files (changes the base class from FormPage to ApprovalFormPage or vice versa).

**Enabling approvals after generation:**
- Adds approval columns to the header table (status, submitted_by, submitted_at, approved_at, approved_by, is_change_order, etc.)
- Changes `page.tsx` and `route.ts` to extend ApprovalFormPage / ApprovalCrudRoute
- Warning dialog: "This will add approval fields to the database and change the base class of the generated files. If you or a customer have customized these files, verify they still work after this change."

**Disabling approvals after generation:**
- Approval columns remain in the database but are no longer managed by the platform
- Changes `page.tsx` and `route.ts` to extend FormPage / CrudRoute
- Warning dialog: "WARNING: Existing records may have approval statuses, audit trails, and change orders. This data will remain but will no longer be managed. The generated files will be modified to remove approval base classes."

**Customer file protection:**
- If the customer files (`customer/forms/<form>/page.tsx` and `route.ts`) are still unmodified shims, the toggle proceeds after the warning confirmation.
- If the customer files have been modified (no longer match the original generated shim), the toggle is BLOCKED. The admin is told: "Customer files have been customized. The base class change must be applied manually to the customer files to avoid breaking their overrides."

This is the ONLY scenario where generated files are modified after initial creation.

## UI — Child Tables as Tabs

All child tables render as tabs on the parent form. There are no inline embedded grids.

### Why Tabs, Not Inline

iSolutions uses proper spacing, touch targets, and typography. Unlike iPurchase's tight packing, there isn't enough vertical space to show header form + detail grid on one screen. Tabs also work on mobile.

### Child Editing — Stacking Slide-In Panels

Clicking a row in a child grid opens a modal slide-in panel from the right:
- The slide-in is modal with an X to close
- Dirty check on close (unsaved changes confirmation)
- Save auto-closes back one level
- Escape key triggers close (with dirty check)

If the child has its own children (grandchild tables), those appear as tabs inside the slide-in. Clicking a grandchild row opens another slide-in that overlays the first.

### Stacking Rules

- Each overlay is at least as wide as its parent — you never see layers underneath
- Overlays stack in order, close in reverse (last-in, first-out)
- The slide-in width is calculated based on the child form's field layout metadata (minimum width to fit fields comfortably)
- Practically, nesting rarely goes beyond 3 levels

```
Main screen (supplier header)
  → Slide-in 1: Address edit (covers main area)
    → Slide-in 2: Contact edit (covers slide-in 1, same or wider)
      → Slide-in 3: If needed (covers slide-in 2)

Close 3 → back to 2
Close 2 → back to 1
Close 1 → back to main
```

## Generated Files — Override Pattern

Generated form files are created once and never regenerated. All customization uses class inheritance with super.

### Three-Tier Ownership

```
FormPage / CrudRoute          ← engine (ISS platform team, upgradeable)
  └── SuppliersPage / Route   ← ISS product (generated once, ISS edits freely)
        └── Customer override ← customer (never touched by upgrades)
```

### File Structure

All four files are generated on first generate. Customer files start as empty shims. Customer files live outside `src/` so product upgrades never touch them.

```
src/components/FormPage.tsx                 ← engine — shared, upgradeable
src/lib/CrudRoute.ts                        ← engine — shared, upgradeable

src/app/forms/suppliers/
  page.tsx              ← ISS product (extends FormPage)
  route.ts              ← ISS product (extends CrudRoute)

customer/forms/suppliers/
  page.tsx              ← customer (extends src version) — menu entry point
  route.ts              ← customer (extends src version) — API entry point
```

The `customer/` folder is outside `src/` and never touched by product upgrades or the generator after initial creation. Menu and API always resolve through the customer layer. ISS product files are never called directly — always through the customer versions.

### Override Pattern

Every internal building block is overridable via super:

**Route:**
```
CrudRoute:
  GET → getColumns(), getFilters(), getSort(), buildQuery(), execute()
  POST → validate, insert
  PUT → validate, update
  DELETE → delete

SuppliersRoute extends CrudRoute:
  table = "suppliers"
  
  POST(request):
    do before-save logic
    result = super.POST(request)    ← standard save
    do after-save logic
    return result

  getColumns():
    columns = super.getColumns()    ← from metadata
    columns.add("computed_total")   ← custom addition
    return columns
```

**Page:**
```
FormPage:
  render → getLayout(), getTabs(), getSections(), getFields(), getChildGrids()

SuppliersPage extends FormPage:
  formKey = "suppliers"
  
  getTabs():
    tabs = super.getTabs()          ← from metadata
    tabs.add("Custom Dashboard")    ← custom addition
    return tabs
```

Full details: see [08-InheritanceAndOverrides.md](./08-InheritanceAndOverrides.md)

## Metadata Drives Everything

The route and page classes contain minimal code — just the table/form name and any overrides. All default behavior comes from metadata:

- **field_config** → columns, types, required flags, labels, defaults
- **screen_layout** → tabs, sections, field placement
- **grid config** → column visibility, sort, filters

No hardcoded column lists, sort orders, or field definitions in code. The Entity Designer writes the metadata, the engine reads it at runtime.
