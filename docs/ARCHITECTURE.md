# iSolutions Architecture & Development Patterns

> **This document is the single source of truth for AI assistants building iSolutions pages.**
> Read it BEFORE writing any code. Follow every pattern exactly.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Layout](#project-layout)
- [Database Standards](#database-standards)
- [Audit Trail System](#audit-trail-system)
- [Frontend Architecture](#frontend-architecture)
- [API Route Pattern](#api-route-pattern)
- [UI Component Reference](#ui-component-reference)
- [Checklist: Adding a New CRUD Screen](#checklist-adding-a-new-crud-screen)
- [Current Tables](#current-tables)
- [Settings Helpers (`src/lib/settings.ts`)](#settings-helpers-srclibsettingsts)
- [Lookup System (Autocomplete + Browse)](#lookup-system-autocomplete-browse)
- [Groups & Group Members](#groups-group-members)
- [Anti-Patterns — DO NOT](#anti-patterns-do-not)
- [Internationalization (i18n)](#internationalization-i18n)

---

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Database**: PostgreSQL 16 with `citext` extension
- **Styling**: CSS custom properties (theme tokens), Tailwind utility classes for layout only
- **State**: React hooks only (no Redux, no Zustand)
- **Auth**: AuthContext (`useAuth` hook) — currently mock, real auth TBD
- **Icons**: Custom SVG icon system (`<Icon name="..." />`)
- **MCP**: iPurchase MCP server at port 8765 for OpenEdge/QAD/DuckDB queries

---

## Project Layout

```
/apps/iSolutions/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # Router — switches on activeNav
│   │   ├── layout.tsx                     # Root layout (ThemeProvider, AuthProvider)
│   │   └── api/
│   │       ├── {entity}/route.ts          # CRUD API (GET/POST/PUT/DELETE)
│   │       ├── {entity}/columns/route.ts  # Column type metadata for DataGrid
│   │       └── audit-log/route.ts         # Audit trail API (dynamic, shared by all pages)
│   ├── components/
│   │   ├── crud-page/CrudPage.tsx         # ★ THE scaffold — all CRUD screens use this
│   │   ├── crud-toolbar/CrudToolbar.tsx   # Save/New/Delete/Copy + extra actions
│   │   ├── data-grid/DataGrid.tsx         # Paginated grid with sort, filter, search, export
│   │   ├── data-grid/AdvancedSearch.tsx   # AND/OR filter tree builder
│   │   ├── audit-panel/AuditPanel.tsx     # Slide-in audit history panel
│   │   ├── icons/Icon.tsx                 # SVG icon system
│   │   ├── pages/                         # One file per screen (config-only, zero layout)
│   │   │   ├── UsersPage.tsx
│   │   │   ├── GroupsPage.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── PasoeBrokers.tsx
│   │   │   ├── Locales.tsx
│   │   │   ├── Translations.tsx
│   │   │   └── Profile.tsx
│   │   ├── shell/                         # AppShell, Header, Sidebar
│   │   ├── theme/                         # ThemeProvider, ThemeToggle
│   │   ├── lookup/                         # Lookup (autocomplete + browse) system
│   │   │   ├── Lookup.tsx                 # Main component: dropdown + search + browse
│   │   │   ├── LookupBrowseModal.tsx      # Full-screen modal with DataGrid for browsing
│   │   │   ├── LookupTypes.ts             # LookupConfig interface
│   │   │   └── presets/                   # Pre-configured lookup factories
│   │   │       ├── UserLookup.ts          # Users (with browse modal)
│   │   │       ├── ActiveUserLookup.ts    # Active users only (extends UserLookup)
│   │   │       ├── DomainLookup.ts        # Domains from ALLOWED_DOMAINS setting
│   │   │       ├── GroupLookup.ts         # Groups (preloaded)
│   │   │       └── LocaleLookup.ts        # Locales with flag icons
│   │   ├── ui/useFieldHelper.tsx           # Auto-wired form field helper
│   │   ├── ui/index.tsx                   # Primitives: Section, Field, Input, Select, Checkbox, Badge, TabBar
│   │   ├── ui/Flag.tsx                    # Inline SVG flags (shared)
│   │   └── ui/LocaleSelect.tsx            # Flag dropdown for forms
│   ├── context/
│   │   ├── AuthContext.tsx                    # User session (fetches /api/auth/me)
│   │   ├── TranslationContext.tsx              # i18n provider, useT() hook
│   │   └── LocaleFromAuth.tsx                 # Bridges auth locale → translations
│   ├── hooks/useIsMobile.ts
│   └── lib/
│       ├── db.ts                          # PostgreSQL pool (node-pg singleton)
│       ├── config.ts                      # Environment config
│       ├── auth.ts                        # getCurrentUser() for auth context
│       ├── filter-sql.ts                  # Advanced filter → parameterized SQL
│       ├── substitute.ts                   # {named} param substitution for i18n
│       ├── translate.ts                   # Backend i18n: translateMessage, getUserLocale
│       ├── settings.ts                    # Setting cascade: getSetting, getSystemSetting, etc.
│       ├── crud-route.ts                  # Generic CRUD handler factory (createCrudRoutes)
│       └── hooks/                         # Server-side CRUD hooks (per-entity validation/logic)
│           ├── index.ts                   # Hook registry (getHooks) + ValidationError
│           └── users-hooks.ts             # Users: delegate validation, etc.
├── scripts/migrate/                       # Numbered Python migration scripts
│   ├── 001_users.py                       # Users table, sessions, etc.
│   ├── 002_audit_columns.py              # Adds 5 audit columns to all tables
│   ├── 003_audit_log.py                  # Audit trail table + triggers
│   ├── 004_notes.py                      # Notes, attachments, mentions
│   ├── 005_oid_primary_keys.py           # Migrate all PKs to oid (UUID)
│   ├── 006_translations.py              # Locales + translations tables
│   ├── 007_dates_to_timestamptz.py       # Date columns → timestamptz
│   ├── 008_locale_flags.py              # Flag SVGs for locales
│   ├── 009_settings.py                  # System settings table
│   ├── 010_user_photo.py               # User profile photos
│   └── 011_groups.py                    # Groups + group_members tables
└── docs/ARCHITECTURE.md                   # ← YOU ARE HERE
```

---

## Database Standards

### ⚠️ Primary key: `oid` (UUID) — ALWAYS

Every table uses `oid uuid DEFAULT gen_random_uuid()` as its **PRIMARY KEY**. No exceptions.

- Natural keys (e.g. `user_id`, `locale + namespace + key`) become **UNIQUE constraints**, not PKs.
- Serial/integer IDs are kept as regular columns if needed for display, never as PKs.
- All CRUD operations (select, update, delete) use `WHERE oid = $1::uuid`.
- The frontend identifies rows by `oid` — row types extend `{ oid: string }`.

### Every table MUST have these 5 standard columns

| Column       | Type           | Default               | Purpose                                    |
|--------------|----------------|-----------------------|--------------------------------------------|
| `oid`        | uuid           | `gen_random_uuid()`   | **PRIMARY KEY**. Immutable row identity.   |
| `created_at` | timestamptz    | `now()`               | Row creation timestamp                     |
| `created_by` | text           | `''`                  | User who created the row                   |
| `updated_at` | timestamptz    | `now()`               | Auto-set by trigger on every UPDATE        |
| `updated_by` | text           | `''`                  | User who last modified the row             |

### Database rules

- The `set_updated_at()` trigger auto-updates `updated_at` — never set it manually in SQL.
- API routes MUST set `created_by` and `updated_by` from the authenticated user.
- All new tables get a migration in `scripts/migrate/NNN_description.py` (Python, idempotent).
### Column Type Conventions

**Case-insensitive text (`citext`) — default for business columns:**

The `citext` extension provides case-insensitive comparisons at the column level, so `WHERE group_id = 'admin'` matches `'Admin'` without `LOWER()` hacks.

| Use `citext` for | Use plain `text` for |
|------------------|---------------------|
| IDs, names, codes, descriptions | Audit columns (`created_by`, `updated_by`) |
| Email, phone, address fields | Internal/system fields |
| Any column users search or filter on | JSON blobs, freeform notes |
| Foreign key references to citext columns | Columns where case matters |

**NOT NULL with empty defaults — the standard pattern:**

All business text columns use `NOT NULL DEFAULT ''`. This eliminates null-vs-empty ambiguity throughout the stack — the frontend never has to distinguish between `null` and `""`.

```sql
-- CORRECT: standard pattern
name        citext NOT NULL DEFAULT '',
description citext NOT NULL DEFAULT '',
domain      citext NOT NULL DEFAULT '*',

-- WRONG: nullable text columns
name        citext,              -- allows NULL ← avoid this
description text DEFAULT NULL,   -- ambiguous ← avoid this
```

**Boolean columns** always use `NOT NULL DEFAULT false` (or `DEFAULT true` for opt-out flags like `is_active`):

```sql
is_active   boolean NOT NULL DEFAULT true,
is_excluded boolean NOT NULL DEFAULT false,
cacheable   boolean NOT NULL DEFAULT false,
```

**Numeric columns** use `NOT NULL DEFAULT 0` when a zero default makes sense:

```sql
approval_limit numeric(15,2) NOT NULL DEFAULT 0,
failed_logins  integer NOT NULL DEFAULT 0,
```

### Uppercase Transforms (Domain Fields)

Fields that must be stored uppercase (like `domain`) use `transforms` in `createCrudRoutes()` rather than database-level enforcement. This keeps the database layer clean and the transform visible in the route config:

```typescript
export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "settings",
  columns: ["owner", "setting_name", "domain", "form", "value"],
  transforms: { domain: (v: string) => v?.trim().toUpperCase() },
  // ...
});
```

Currently used on: `pasoe_brokers` (domain), `settings` (domain). Add transforms for any field that needs normalization before save.

### Table Naming & Identity

- Table names: `snake_case`, descriptive names (e.g. `pasoe_brokers`, `users`, `translations`).
- **One name everywhere**: The table name IS the nav key, API route folder, and grid ID. Example: table `pasoe_brokers` → nav key `pasoe_brokers`, API at `/api/pasoe_brokers`, `gridId: "pasoe_brokers"`. This eliminates mapping tables and keeps navigation, notifications, and audit trail simple.

### Complete table creation template

Every new table follows this exact pattern. Copy and adapt:

```python
#!/usr/bin/env python3
\"\"\"Migration NNN: Create my_table.\"\"\"

import psycopg2

conn = psycopg2.connect(dbname="isolutions", user="ipurchase", password="ipurchase", host="localhost")
conn.autocommit = True
cur = conn.cursor()

cur.execute(\"\"\"
CREATE TABLE IF NOT EXISTS my_table (
  -- Business columns
  name            citext NOT NULL DEFAULT '',
  description     citext NOT NULL DEFAULT '',
  is_active       boolean NOT NULL DEFAULT true,

  -- Standard columns (MANDATORY on every table)
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  oid             uuid NOT NULL DEFAULT gen_random_uuid(),

  -- PK is ALWAYS oid
  PRIMARY KEY (oid)

  -- Natural keys become UNIQUE constraints (if applicable)
  -- UNIQUE (name)
  -- UNIQUE (locale, namespace, key)
);
\"\"\")
print("✓ my_table created")

# Indexes (add as needed for query patterns)
cur.execute("CREATE INDEX IF NOT EXISTS idx_my_table_name ON my_table(name);")
print("✓ indexes created")

# Auto-update trigger (MANDATORY on every table)
cur.execute(\"\"\"
    CREATE OR REPLACE FUNCTION my_table_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_my_table_updated_at ON my_table;
    CREATE TRIGGER trg_my_table_updated_at
        BEFORE UPDATE ON my_table
        FOR EACH ROW EXECUTE FUNCTION my_table_set_updated_at();
\"\"\")
print("✓ audit trigger created")

cur.close()
conn.close()
print("\\n✅ Migration NNN complete")
```

### Column comments (for future i18n)

Use PostgreSQL `COMMENT ON COLUMN` to store display labels. These will be used by the translation system when it's wired up:

```sql
COMMENT ON COLUMN my_table.name IS 'Name';
COMMENT ON COLUMN my_table.is_active IS 'Active';
```

---

## Audit Trail System

The audit trail automatically tracks field-level changes (INSERT, UPDATE, DELETE) on any table that has an audit trigger attached. It is fully integrated into the CrudPage scaffold — **no per-page code is needed**.

### How it works

1. **Database trigger** (`audit_log_notify`) fires on INSERT/UPDATE/DELETE
2. On UPDATE, logs **one row per changed field** with old and new values
3. On INSERT/DELETE, logs a single summary row
4. Skips the 5 audit meta-columns to reduce noise
5. The `audit_log` table stores all changes with `table_name`, `record_oid`, `field_name`, `old_value`, `new_value`, `changed_by`, `changed_at`

### CrudPage auto-wiring (zero config)

CrudPage provides three automatic audit features for every screen:

| Feature | How it works | Config needed? |
|---------|-------------|----------------|
| **Audit footer** | Compact strip pinned below the form: "Created 3/1/2026 by frank · Updated 3/1/2026 by frank — *View history*" | None — reads `created_at`, `created_by`, `updated_at`, `updated_by` from the row |
| **Audit grid columns** | `created_at`, `created_by`, `updated_at`, `updated_by` auto-injected into every DataGrid. Hidden by default, available in column chooser and searchable. | None — auto-injected unless page already defines them |
| **Audit button + panel** | Shield icon in toolbar opens a slide-in panel with full field-level change history | Requires `exportConfig.table` on the page config (already needed for CSV export) |

The Audit button and panel auto-derive the table name from `exportConfig.table` and the record identifier from `row.oid`. No `auditConfig` property is needed.

### API: `/api/audit-log`

Single shared endpoint for all pages:

```
GET /api/audit-log?table=pasoe_brokers&oid=<uuid>&offset=0&limit=100
```

- **Dynamic whitelist**: Queries `information_schema.triggers` to find tables with the `audit_log_notify` function — no hardcoded table list
- Validates table name format (alphanumeric + underscore) and oid format (UUID)
- Joins to `users` table to resolve `changed_by` user IDs to full names (`changed_by_name`)
- Returns entries newest-first, paginated

### AuditPanel component

Slide-in overlay panel (480px, fixed right) with:
- Timeline view grouped by timestamp + user + action
- Color-coded dots: green (INSERT), red (DELETE), yellow (UPDATE)
- Field change table showing Field / Before / After with color-coded values
- Empty, loading, and error states

### Adding audit to a new table

When creating a new table, add it to the `AUDITED_TABLES` list in `scripts/migrate/003_audit_log.py` and re-run the migration. That's it — CrudPage handles everything else automatically.

```python
# In 003_audit_log.py
AUDITED_TABLES = ["users", "pasoe_brokers", "your_new_table"]
```

Then re-run: `python3 scripts/migrate/003_audit_log.py`

The trigger naming convention is `trg_{table}_audit` (e.g. `trg_users_audit`, `trg_pasoe_brokers_audit`).

---

## Frontend Architecture

### The CrudPage Scaffold — MANDATORY

**Every CRUD screen MUST use `<CrudPage config={config} />`.**

Do NOT hand-roll AppShell + DataGrid + detail panel layouts. The scaffold guarantees:
- Identical layout, mobile responsive behavior, keyboard nav across all pages
- DataGrid left panel: search, sort, filter, column chooser, export, pagination
- Detail right panel: CrudToolbar, error bar, delete confirmation, scrollable form
- Audit footer: created/updated timestamps and user, with "View history" link
- Audit grid columns: `created_at`, `created_by`, `updated_at`, `updated_by` auto-injected
- Audit button + panel: auto-wired from `apiPath`
- Desktop: grid starts expanded, collapses to 420px when a record is selected
- Mobile: full-screen grid → full-screen detail with back arrow
- All state management: selection, dirty tracking, save/delete/new/copy handlers

**CrudPage auto-derives everything from `apiPath`:**
- `fetchPage` — generic fetch from `apiPath` with offset/limit/search/sort/filters
- `gridId` — table name from apiPath (e.g. `/api/users` → `users`)
- `colTypes` — fetched from `/api/columns?table={tableName}`
- `emptyRow` — built from column definitions with `oid: ""`
- `deleteLabel` — first column value of the selected row
- `detailTitle` — first column value of the selected row
- `defaultVisible` — first 4 columns
- `searchPlaceholder` — `"Search {title}..."`
- `exportConfig` — derived from table name + first 3 searchable columns
- `copyRow` — spreads row with `oid: ""`
- Save: `POST apiPath` (new) or `PUT apiPath` (existing, identified by `oid`)
- Delete: `DELETE apiPath?oid=X`
- Select: `GET apiPath?oid=X&limit=1`

**Pages are config-only. No CRUD logic, no fetch functions, no type definitions.**

### How to create a new CRUD page

A page is just **config + detail form**. No CRUD logic, no fetch functions, no type definitions.

#### Step 1: Create the API route (1 file, ~15 lines)

```typescript
// src/app/api/my_table/route.ts
import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "my_table",
  columns: ["name", "description", "is_active"],
  defaultSort: "name",
  searchColumns: ["name", "description"],
  requiredFields: ["name"],
});
```

#### Step 2: Create the page component

```typescript
// src/components/pages/MyTable.tsx
"use client";
import { useMemo } from "react";
import { CrudPage, type CrudPageConfig } from "@/components/crud-page/CrudPage";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { Section } from "@/components/ui";
import { useT } from "@/context/TranslationContext";
import { useFieldHelper } from "@/components/ui/useFieldHelper";

type Row = { oid: string; [key: string]: any };

// Only override columns that need custom behavior; rest auto-discover from DB schema
const COLUMNS: ColumnDef<Row>[] = [
  { key: "name", locked: true },
];

function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }: {
  row: Row; isNew: boolean; onChange: (field: keyof Row, value: any) => void;
  colTypes: Record<string, string>; colScales: Record<string, number>; requiredFields?: string[];
}) {
  const { field } = useFieldHelper({ row, onChange, table: "my_table", colTypes: colTypes as any, colScales, requiredFields });
  return (
    <Section title="General">
      {field("name", { autoFocus: isNew })}
      {field("description")}
      {field("is_active")}
    </Section>
  );
}

export default function MyTable({ activeNav, onNavigate, selectRecordOid, selectSeq }: {
  activeNav: string; onNavigate: (k: string, oid?: string) => void; selectRecordOid?: string; selectSeq?: number;
}) {
  const config = useMemo((): CrudPageConfig<Row> => ({
    title: "My Table",
    apiPath: "/api/my_table",
    columns: COLUMNS,
    renderDetail: (props) => <Detail {...props} />,
  }), []);

  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate}
    selectRecordOid={selectRecordOid} selectSeq={selectSeq} />;
}
```

That's it. **3 required config fields**: `title`, `apiPath`, `renderDetail` (or `renderTabs`). `columns` is optional — auto-discovered from the database schema.

#### Step 3: Register in the router

In `src/app/page.tsx`:
```typescript
import MyTable from "@/components/pages/MyTable";
// ...
if (activeNav === "my_table") return <MyTable activeNav={activeNav} onNavigate={handleNavigate} selectRecordOid={recordOid} selectSeq={selectSeq} />;
```

And add a nav entry in `src/components/shell/Sidebar.tsx`.

#### Optional page features

| Feature | How |
|---------|-----|
| Tabbed detail form | Provide `renderTabs` instead of `renderDetail` |
| Custom list card | Provide `renderCard` |
| Extra toolbar buttons | Provide `extraActions` |
| Lock a column | `{ key: "user_id", locked: true }` in `columns` — cannot be hidden by user |
| Hide a column | `{ key: "internal_field", hidden: true }` in `columns` — excluded from grid entirely |
| Custom column order | List columns in `columns` array — unlisted schema columns append at end |

### renderDetail vs renderTabs

| Mode | When to use | Who owns scroll? |
|------|-------------|------------------|
| `renderDetail` | Simple form, no tabs | CrudPage wraps in scrollable container |
| `renderTabs` | Tabbed interface | YOU own the scroll. Render `<TabBar>` + scrollable content. |

When using `renderTabs`, `renderDetail` can be omitted.

---

## API Route Pattern

### `createCrudRoutes` — The Standard Way

Every entity's API route uses the generic `createCrudRoutes()` factory from `src/lib/crud-route.ts`. **Do NOT hand-roll CRUD handlers.** The factory automatically provides: parameterized queries, column whitelisting, search, advanced filters, sort, pagination, oid-based select, type coercion, `created_by`/`updated_by` stamping, `requiredFields` validation, hooks, and i18n error translation.

```typescript
// src/app/api/my_table/route.ts
import { createCrudRoutes } from "@/lib/crud-route";

export const { GET, POST, PUT, DELETE } = createCrudRoutes({
  table: "my_table",
  columns: ["name", "domain", "description", "is_active"],
  defaultSort: "name",
  searchColumns: ["name", "description"],
  requiredFields: ["name"],
});
```

**`CrudRouteConfig` options:**

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `table` | `string` | *required* | PostgreSQL table name |
| `columns` | `string[]` | *required* | Columns exposed to the API (whitelist for search/sort/filter) |
| `defaultSort` | `string` | `columns[0]` | Default ORDER BY column |
| `searchColumns` | `string[]` | all `columns` | Columns searched by the `?search=` parameter |
| `requiredFields` | `string[]` | `[]` | Fields validated on POST/PUT; also exposed in GET response for frontend auto-asterisks |
| `writableFields` | `string[]` | `columns` minus system cols | Fields allowed in INSERT/UPDATE (subset of columns) |
| `transforms` | `Record<string, (v) => any>` | `{}` | Per-field transform functions applied before save |
| `uniqueErrorMsg` | `(body) => string` | generic | Custom 409 conflict message |

**What the factory provides for each verb:**

| Verb | Behavior |
|------|----------|
| **GET** | Paginated list with `?offset=&limit=&search=&sort=&dir=&filters=`. Single-record select with `?oid=`. Returns `{ rows, total, offset, limit, requiredFields }`. Auto-discovers column types from `information_schema`. |
| **POST** | Insert with `created_by`/`updated_by` from auth. Validates `requiredFields`. Coerces types. Runs `beforeSave`/`afterSave` hooks. Returns 201. Catches unique violations → 409. |
| **PUT** | Update by `oid`. Validates `requiredFields` (only for fields present in body). Coerces types. Runs hooks. Returns 200. |
| **DELETE** | Delete by `?oid=`. Runs `beforeDelete` hook. Returns `{ ok: true }`. |

**Critical rules:**
- All queries are parameterized — the factory handles this automatically
- Column types are auto-discovered from `information_schema` — no separate per-entity columns route needed
- POST/PUT automatically set `created_by` / `updated_by` from the authenticated user
- POST returns **201**, PUT returns **200**, unique violations return **409**
- `updated_at` is handled by the database trigger — never set it in code
- `requiredFields` are validated server-side on POST (all fields) and PUT (only fields present in body)

### Column Type Metadata

Column types are auto-discovered by the GET handler using `information_schema.columns`. A shared `/api/columns?table={name}` endpoint also exists for the DataGrid to use in advanced search filter operators. No per-entity columns route is needed.

---


## UI Component Reference

### Primitives (`@/components/ui`)

| Component  | Key Props | Notes |
|------------|-----------|-------|
| `Section`  | `title` | Groups fields with uppercase header |
| `Field`    | `label, required?, error?` | Wraps input with label + required asterisk. `error` adds red border + message below. |
| `Input`    | `value, onChange?, readOnly?, type?, placeholder?` | onChange receives string value (not event). Coerces null/undefined to "". |
| `Select`   | `value, onChange, options: {value,label}[]` | onChange receives string value |
| `Checkbox` | `checked, onChange, label` | onChange receives boolean |
| `Badge`    | `variant: "success"\|"danger"\|"warning"\|"neutral"\|"info"` | Status pill |
| `TabBar`   | `tabs: TabDef[], active, onChange` | `TabDef = { key, label, icon? }` |
| `DatePicker` | `value, onChange, mode?, readOnly?` | See DatePicker section below |
| `NumberInput` | `value, onChange, scale?, readOnly?` | Locale-aware formatting with grouping separators |
| `Toggle`   | `value, onChange, triState?, readOnly?` | Sliding on/off (or on/null/off) toggle |
| `EmailInput` | `value, onChange, multiple?, readOnly?` | Validates email; multi-mode shows chips |

### Icons (`<Icon name="..." size={18} />`)

Available names: `menu`, `search`, `plus`, `save`, `trash`, `copy`, `key`, `download`, `upload`, `unlock`, `shield`, `users`, `user`, `settings`, `briefcase`, `clock`, `mail`, `lock`, `chart`, `chevUp`, `chevDown`, `chevRight`, `chevLeft`, `chevFirst`, `chevLast`, `x`, `check`, `sortAsc`, `sortDesc`, `tag`, `arrowLeft`, `server`, `activity`, `messageSquare`, `logOut`, `columns`, `filter`, `expand`, `collapse`, `eye`, `eyeOff`


### DatePicker (`@/components/ui/DatePicker`)

Locale-aware date/datetime/range picker with calendar popup.

```tsx
import { DatePicker } from "@/components/ui/DatePicker";

// Date only
<DatePicker value={row.expire_date} onChange={v => onChange("expire_date", v)} mode="date" />

// Datetime
<DatePicker value={row.last_login} onChange={v => onChange("last_login", v)} mode="datetime" readOnly />

// Date range (e.g. for filters)
<DatePicker mode="range" value={start} onChange={setStart} valueTo={end} onChangeTo={setEnd} presets />
```

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `value` | `string \| null` | — | ISO date string |
| `onChange` | `(v: string \| null) => void` | — | |
| `mode` | `"date" \| "datetime" \| "range"` | `"date"` | |
| `readOnly` | `boolean` | `false` | Hides calendar icon and time picker |
| `min` / `max` | `string` | — | ISO date bounds |
| `timeStep` | `number` | `15` | Minutes between time options |
| `presets` | `boolean` | `false` | Show preset sidebar (range mode) |
| `clearable` | `boolean` | `true` | Show clear button |

**Files:** `DatePicker.tsx`, `DatePickerCalendar.tsx`, `DatePickerTime.tsx`, `DatePickerPresets.tsx`, `date-utils.ts`

Locale behavior: detects MDY/DMY/YMD order, date separator, 12h/24h from browser locale. Placeholder auto-generates (e.g. "MM/DD/YYYY" or "DD.MM.YYYY").

### NumberInput (`@/components/ui/NumberInput`)

Locale-aware number input. Shows formatted value (with grouping separators) when blurred, raw editable value when focused.

```tsx
import { NumberInput } from "@/components/ui/NumberInput";

<NumberInput value={row.approval_limit} onChange={v => onChange("approval_limit", v)} scale={2} />
```

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `value` | `number \| string` | — | |
| `onChange` | `(v: number) => void` | — | Always emits a number |
| `scale` | `number` | `2` | Decimal places for display |
| `readOnly` | `boolean` | `false` | |

**Files:** `NumberInput.tsx`, `number-utils.ts`

Formatting: uses `Intl.NumberFormat` for locale-appropriate grouping (e.g. `1,234.56` in en-US, `1.234,56` in de). Prevents alpha character entry.

### Toggle (`@/components/ui/Toggle`)

Sliding toggle for boolean fields. Supports two-state (true/false) and three-state (true/null/false).

```tsx
import { Toggle } from "@/components/ui/Toggle";

// Two-state
<Toggle value={row.is_active} onChange={v => onChange("is_active", v)}
  colorOn="green" colorOff="red" labelOn="Active" labelOff="Inactive" />

// Three-state (nullable boolean)
<Toggle value={row.flag} onChange={v => onChange("flag", v)} triState
  labelOn="Yes" labelOff="No" labelNull="Unknown" />
```

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `value` | `boolean \| null` | — | |
| `onChange` | `(v: boolean \| null) => void` | — | |
| `triState` | `boolean` | `false` | Enable null middle state |
| `size` | `"sm" \| "md"` | `"md"` | |
| `colorOn` / `colorOff` | `string` | accent/gray | CSS color values |
| `labelOn` / `labelOff` / `labelNull` | `string` | — | Text shown beside toggle |
| `readOnly` | `boolean` | `false` | |

Cycle behavior in triState: `false → null → true → false`

### EmailInput (`@/components/ui/EmailInput`)

Email input with validation. Single mode for one address, multi mode for chip-based entry.

```tsx
import { EmailInput } from "@/components/ui/EmailInput";

// Single email (e.g. Users page)
<EmailInput value={row.email} onChange={v => onChange("email", v)} required />

// Multiple emails (semicolon-separated in DB)
<EmailInput value={row.notify_emails} onChange={v => onChange("notify_emails", v)} multiple />
```

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `value` | `string` | — | Single email or semicolon-separated list |
| `onChange` | `(v: string) => void` | — | |
| `multiple` | `boolean` | `false` | Chip-based multi-email mode |
| `required` | `boolean` | `false` | |
| `readOnly` | `boolean` | `false` | |

Multi mode: Enter, comma, semicolon, or blur to add. Backspace to remove last. Deduplicates. Validation error is i18n-translated (`validation.invalid_email`).

### DataGrid Auto-Formatting

The DataGrid automatically formats cell values based on column type (from `/api/columns`):

| Column Type | Display | Alignment |
|-------------|---------|-----------|
| `text` | As-is | Left |
| `number` | Locale-formatted with grouping (e.g. `1,234.56`) | Right |
| `boolean` | Green `✓` for true, blank for false | Center |
| `datetime` | Locale-formatted date + time | Left |
| `date` | Locale-formatted date only | Left |

No manual `render` functions needed for standard formatting. Custom renderers still override when provided.

### Column Auto-Discovery

Grid columns are auto-generated from the database schema via `/api/columns?table={name}`. Labels are translated using the `{table}.field.{column}` key convention (e.g. `users.field.full_name`), falling back to humanized column names (e.g. `full_name` → "Full Name").

**Column cascade (most specific wins):**

1. **Schema** — all columns from the database table (minus system columns: oid, audit fields, password_hash)
2. **Page overrides** (`config.columns`) — define order, lock/hide columns, add custom renderers
3. **Grid defaults** (`grid_defaults` table) — admin-configured default visible set
4. **User prefs** (`grid_user_prefs` table) — per-user column visibility saved via column chooser

**ColumnDef flags:**

| Flag | Effect |
|------|--------|
| `locked: true` | Column cannot be hidden via column chooser |
| `hidden: true` | Column excluded from grid entirely (not in chooser) |
| `render: (row) => ReactNode` | Custom cell renderer (overrides auto-format) |

**Minimal page config (auto-discover everything):**
```tsx
const config = {
  title: "Users",
  apiPath: "/api/users",
  columns: [{ key: "user_id", locked: true }],  // only overrides
  renderTabs: (props) => <UserTabs {...props} />,
};
```

### useFieldHelper — Auto-Wired Form Fields

The `useFieldHelper` hook eliminates form field boilerplate. Instead of manually wiring `value`, `onChange`, labels, and picking the right component for every field, you call `field("name")` and everything is auto-derived.

**Import:** `import { useFieldHelper } from "@/components/ui/useFieldHelper";`

**Setup in a detail component:**
```tsx
function Detail({ row, isNew, onChange, colTypes, colScales, requiredFields }) {
  const { field } = useFieldHelper({ row, onChange, table: "my_table", colTypes, colScales, requiredFields });
  return (
    <Section title="General">
      {field("name", { autoFocus: isNew })}
      {field("description")}
      {field("is_active")}
      {field("amount")}
      {field("due_date")}
    </Section>
  );
}
```


**Required Fields — Auto-Derived from Backend:**

Required field indicators (red asterisks) are **automatically derived** from the backend `requiredFields` array — no frontend annotation needed for most fields.

**How it works:**
1. The API route declares `requiredFields: ["user_id", "full_name", "email"]` in `createCrudRoutes()`
2. The GET response includes `requiredFields` alongside `rows` and `total`
3. CrudPage captures `requiredFields` from the first fetch and passes it to `renderDetail`/`renderTabs`
4. Detail components pass `requiredFields` to `useFieldHelper()`
5. `field("full_name")` auto-shows a red asterisk because `"full_name"` is in the backend list

**Override precedence:** Explicit `required: true/false` in a field override always wins over the backend list. This means you can suppress an asterisk with `required: false` or add one not in the backend list with `required: true`.

```tsx
// Auto-derived: asterisk shown because "full_name" is in backend requiredFields
{field("full_name")}

// Explicit override: suppresses asterisk even if in backend list
{field("full_name", { required: false })}

// Explicit override: adds asterisk for a field NOT in backend list
{field("notes", { required: true })}
```

**Validation on save:**

`useFieldHelper` returns `{ field, validate }`. CrudPage checks all fields marked required before save:

- **On save**: Empty required fields get a red border and "Required" message below
- **On edit**: Error clears as soon as the user modifies the field
- **No page code needed**: Required fields are enforced both client-side (asterisk + validation) and server-side (400 error on blank)

The validation is DOM-based using `data-required` attributes. CrudPage scans for `[data-required]` elements, checks their input values, and blocks save if any are empty. The "Required" message is i18n via `t("validation.required", "Required")`.

**What `field("name")` auto-derives:**

| Concern | How it's resolved |
|---------|-------------------|
| **Label** | `t("{table}.field.{name}", humanize(name))` — translated, falls back to Title Case. `humanize` strips `_id` suffix and converts `_nbr` to "Number". |
| **Value** | `row[field]` |
| **onChange** | `v => onChange(field, v)` |
| **Component** | Detected from `colTypes[field]` (see table below) |
| **Null safety** | Text → `?? ""`, boolean → `?? false`, number → `?? 0`, date → `?? null` |

**Auto-detected component by column type:**

| Column Type | Component | Notes |
|-------------|-----------|-------|
| `text` | `Input` | Default for unknown types too |
| `boolean` | `Toggle` | Two-state on/off |
| `number` | `NumberInput` | Scale from `colScales`, locale-formatted |
| `datetime` | `DatePicker mode="datetime"` | |
| `date` | `DatePicker mode="date"` | |
| Field named `email` / `*_email` / `*_emails` | `EmailInput` | Smart name detection |

**Overriding the component type:**
```tsx
{field("date_format", { type: "select", options: DATE_FORMATS })}
{field("is_default", { type: "checkbox", checkLabel: "Use as system default" })}
{field("email", { type: "email", required: true })}
{field("status", { type: "toggle", colorOn: "green", colorOff: "red" })}
```

Available `type` values: `"input"`, `"email"`, `"select"`, `"checkbox"`, `"toggle"`, `"datepicker"`, `"number"`, `"lookup"`

**Overriding any prop:**
```tsx
{field("user_id", { required: true, readOnly: !isNew })}    // required + conditional readOnly
{field("name", { autoFocus: isNew })}                        // autoFocus on new records
{field("code", { placeholder: "e.g. en-us" })}               // placeholder
{field("decimal_char", { maxLength: 1 })}                     // extra HTML attribute
{field("amount", { scale: 4 })}                               // override decimal scale
{field("is_active", { colorOn: "#28a745", colorOff: "#dc3545" })}  // toggle colors
{field("label", { label: "Custom Label" })}                   // override translated label
```

**Escape hatch — raw JSX for fully custom components:**
```tsx
<Section title="Identity">
  {field("user_id", { required: true })}
  {field("full_name", { required: true })}
  {/* Custom component that field() can't auto-wire */}
  <Field label={t("users.locale", "Language")}>
    <LocaleSelect value={row.locale} onChange={v => onChange("locale", v)} options={localeOpts} />
  </Field>
  {field("domains")}
</Section>
```

**Full override reference:**

| Override | Type | Used by |
|----------|------|---------|
| `type` | `FieldType` | All — override auto-detected component |
| `label` | `string` | All — override translated label |
| `required` | `boolean` | All — shows asterisk. Auto-derived from backend `requiredFields`; explicit override wins. |
| `readOnly` | `boolean` | All — disables editing |
| `autoFocus` | `boolean` | Input, EmailInput |
| `placeholder` | `string` | Input, EmailInput, NumberInput |
| `options` | `{value, label}[]` | Select — required when `type: "select"` |
| `scale` | `number` | NumberInput — decimal places |
| `colorOn` / `colorOff` | `string` | Toggle — custom colors |
| `labelOn` / `labelOff` / `labelNull` | `string` | Toggle — text labels |
| `triState` | `boolean` | Toggle — enable null middle state |
| `checkLabel` | `string` | Checkbox — text beside checkbox |
| `multiple` | `boolean` | EmailInput — chip-based multi mode |
| `mode` | `"date" \| "datetime" \| "range"` | DatePicker |
| `presets` | `boolean` | DatePicker — show preset sidebar |
| Any extra prop | `any` | Spread onto the inner component |

**CrudPage integration:**

CrudPage automatically passes `colTypes`, `colScales`, and `requiredFields` to `renderDetail` and `renderTabs` props, so detail components always have type metadata and required field indicators available. No extra wiring needed.

### Type Coercion in CRUD Routes

The generic `crud-route.ts` automatically coerces values before sending to PostgreSQL:

| Column Type | Empty string → | null → |
|-------------|---------------|--------|
| `datetime` / `date` | `null` | `null` |
| `number` | `0` | `0` |
| `boolean` | `false` | `false` |
| `text` / `citext` | `null` | `null` |

This prevents "invalid input syntax" errors when saving empty date fields, etc. **Important:** Because empty text becomes `null`, text columns that are not truly required should allow NULL (avoid `NOT NULL` constraints on optional text fields).


### CRUD Hooks (Server-Side Business Logic)

Per-entity hooks allow custom validation, transformation, and side effects during CRUD operations. Hooks run server-side in `crud-route.ts`.

**Hook interface:**

```typescript
interface CrudHooks {
  beforeSave?: (row: any, existing: any | null, req: NextRequest) => Promise<void>;
  afterSave?:  (row: any, existing: any | null, req: NextRequest) => Promise<void>;
  beforeDelete?: (oid: string, req: NextRequest) => Promise<void>;
}
```

- `beforeSave` — Runs before INSERT or UPDATE. Use for validation, field transformation, or blocking saves. `existing` is `null` on INSERT.
- `afterSave` — Runs after INSERT or UPDATE. Use for side effects (e.g. sending notifications, cascading updates).
- `beforeDelete` — Runs before DELETE. Use to block deletion or clean up related records.

**Throwing validation errors:**

```typescript
// In a hook file:
import { ValidationError } from "@/lib/crud-route";

export const hooks: CrudHooks = {
  async beforeSave(row, existing, req) {
    if (row.delegate_id === row.user_id) {
      throw new ValidationError("A user cannot be their own delegate", {
        translationKey: "message.delegate_self",
      });
    }
  },
};
```

`ValidationError` accepts an optional `translationKey` and `params` object. The CRUD route catches it and translates the message to the user's locale before returning the 400 response.

**Hook registry — `src/lib/hooks/index.ts`:**

```typescript
import { usersHooks } from "./users-hooks";
import { customersHooks } from "./customers-hooks";

const registry: Record<string, CrudHooks> = {
  users: usersHooks,
  customers: customersHooks,
};

export function getHooks(table: string): CrudHooks {
  return registry[table] || {};
}
```

Each entity's hooks live in `src/lib/hooks/{entity}-hooks.ts`. Register by adding to the `registry` map.

### Backend i18n (Server-Side Translation)

When the backend needs to return translated error messages (e.g. validation errors from CRUD routes), it uses helper functions in `crud-route.ts`:

```typescript
// Translate a ValidationError that has a translationKey + params
resolveValidationError(err: ValidationError, req: NextRequest): Promise<string>

// Translate "{field} is required" for a specific field
resolveFieldRequired(field: string, req: NextRequest): Promise<string>

// Translate a simple key like "message.not_found"
resolveSimpleKey(key: string, fallback: string, req: NextRequest): Promise<string>
```

These functions:
1. Read the user's locale from the `x-user-locale` header (set by middleware) or fall back to `en-us`
2. Query the `translations` table for the matching `locale + namespace + key`
3. Substitute `{named}` parameters using `substitute(template, params)`
4. Return the translated string, or the English fallback if no translation exists

### Styling rules

- **ALWAYS** use CSS custom properties for colors — `var(--text-primary)`, `var(--bg-surface)`, etc.
- **NEVER** hardcode colors (`#333`, `text-gray-500`, `rgb(...)`)
- Tailwind is OK for layout: `flex`, `gap-2`, `grid`, `px-4`, `rounded`, etc.
- Form grids: `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4"`
- Theme handles light/dark automatically through CSS variables.

### Key theme tokens

All colors are defined as CSS custom properties in `src/app/globals.css` with light and dark mode variants. **Never hardcode colors — always use these tokens.**

#### Backgrounds

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg-body` | `#f8fafc` | `#0c0f1a` | Page background |
| `--bg-surface` | `#ffffff` | `#151927` | Cards, panels, detail area |
| `--bg-surface-alt` | `#f1f5f9` | `#1c2235` | Zebra rows, alternate surfaces |
| `--bg-hover` | `#f1f5f9` | `#1c2235` | Row/item hover state |
| `--bg-selected` | `#eff6ff` | `#172044` | Selected row highlight |
| `--bg-overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | Modal/dialog backdrop |

#### Sidebar

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--sidebar-bg` | `#0f172a` | `#090c16` | Sidebar background |
| `--sidebar-text` | `#94a3b8` | `#64748b` | Inactive nav item text |
| `--sidebar-text-hover` | `#ffffff` | `#e2e8f0` | Hovered nav item text |
| `--sidebar-active-bg` | `rgba(37,99,235,0.15)` | `rgba(37,99,235,0.2)` | Active nav item background |
| `--sidebar-active-text` | `#60a5fa` | `#60a5fa` | Active nav item text |
| `--sidebar-border` | `rgba(51,65,85,0.5)` | `rgba(30,41,59,0.8)` | Sidebar dividers |
| `--sidebar-section` | `#64748b` | `#475569` | Section header text |

#### Text

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--text-primary` | `#0f172a` | `#e2e8f0` | Headings, field values, primary content |
| `--text-secondary` | `#475569` | `#94a3b8` | Grid cells, descriptions |
| `--text-muted` | `#94a3b8` | `#475569` | Placeholders, disabled text, hints |
| `--text-inverse` | `#ffffff` | `#0f172a` | Text on accent/dark backgrounds |

#### Borders

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--border` | `#e2e8f0` | `#1e293b` | Standard borders (panels, sections) |
| `--border-light` | `#f1f5f9` | `#1c2235` | Subtle dividers (grid rows) |
| `--border-focus` | `#60a5fa` | `#3b82f6` | Focused input border |

#### Accent (brand/action)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--accent` | `#2563eb` | `#3b82f6` | Primary buttons, links, active indicators |
| `--accent-hover` | `#1d4ed8` | `#2563eb` | Hovered primary buttons |
| `--accent-light` | `#dbeafe` | `#172044` | Accent tinted backgrounds (badges, pills) |
| `--accent-text` | `#ffffff` | `#ffffff` | Text on accent backgrounds |

#### Status

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--success-bg` | `#dcfce7` | `#052e16` | Success badge/alert background |
| `--success-text` | `#15803d` | `#4ade80` | Success text, boolean ✓ in grid, active toggle |
| `--danger-bg` | `#fef2f2` | `#2c0b0e` | Error/danger badge/alert background |
| `--danger-text` | `#dc2626` | `#f87171` | Error text, inactive toggle, delete buttons |
| `--danger-border` | `#fecaca` | `#7f1d1d` | Error input border |
| `--warning-bg` | `#fffbeb` | `#2c1f08` | Warning badge/alert background |
| `--warning-text` | `#d97706` | `#fbbf24` | Warning text |

#### Inputs

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--input-bg` | `#ffffff` | `#1c2235` | Editable input background |
| `--input-border` | `#cbd5e1` | `#2d3754` | Editable input border |
| `--input-bg-ro` | `#f8fafc` | `#151927` | Read-only input background |
| `--input-border-ro` | `#e2e8f0` | `#1e293b` | Read-only input border |

#### Effects

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--ring-focus` | `rgba(59,130,246,0.2)` | `rgba(59,130,246,0.3)` | Focus ring (box-shadow) |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | `0 4px 6px -1px rgba(0,0,0,0.4)` | Dropdowns, popovers |

#### Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-width` | `240px` | Sidebar width |
| `--header-height` | `52px` | Top header height |

---

## Checklist: Adding a New CRUD Screen

1. [ ] **Database**: Create table with all 5 audit columns + `set_updated_at` trigger
2. [ ] **Audit trigger**: Add table to `AUDITED_TABLES` in `003_audit_log.py` and re-run
3. [ ] **Migration**: `scripts/migrate/NNN_description.py` (idempotent)
4. [ ] **API route**: `src/app/api/{table_name}/route.ts` (GET/POST/PUT/DELETE)
5. [ ] **Columns route**: `src/app/api/{table_name}/columns/route.ts`
6. [ ] **Page component**: `src/components/pages/MyPage.tsx` — config-only, uses `<CrudPage>`
7. [ ] **Router entry**: `if (activeNav === "x")` in `src/app/page.tsx`
8. [ ] **Sidebar entry**: Nav item in `src/components/shell/Sidebar.tsx` — key MUST match table name
9. [ ] **Translations**: Add `{table}.field.{column}` rows for ALL columns (including `created_at`, `created_by`, `updated_at`, `updated_by`) × all 16 locales. See "Column Label Translations" below.
10. [ ] **Verify**: Grid loads, search works, select shows detail, save/new/delete/copy all work
11. [ ] **Verify audit**: Footer shows timestamps, Audit button opens panel, changes are tracked
12. [ ] **Verify i18n**: Switch to non-English locale, confirm all column headers in grid/column picker/advanced search are translated

---

## Current Tables

| Table | Purpose | PK | Natural Key |
|-------|---------|-----|-------------|
| `users` | User accounts, profiles, permissions | `oid` | `user_id` (UNIQUE) |
| `pasoe_brokers` | PASOE/QAD broker connection configs | `oid` | — |
| `audit_log` | Field-level change history | `oid` | — |
| `grid_defaults` | Default grid column visibility | `oid` | `grid_id` (UNIQUE) |
| `grid_user_prefs` | Per-user grid column prefs | `oid` | `(grid_id, user_id)` (UNIQUE) |
| `saved_filters` | Saved advanced search filters | `oid` | — |
| `notes` | Notes/comments on any record | `id` (serial) | — |
| `note_attachments` | File attachments on notes | `id` (serial) | — |
| `note_mentions` | @mention tracking for notifications | `id` (serial) | — |
| `notifications` | User notification queue | `oid` | — |
| `locales` | Language definitions (date/number format) | `oid` | `code` (UNIQUE) |
| `translations` | i18n string translations | `oid` | `(locale, namespace, key)` (UNIQUE) |
| `settings` | System & user configuration key-value pairs | `oid` | `(owner, setting_name, domain, form)` (UNIQUE) |
| `groups` | User groups for approval routing & permissions | `oid` | `group_id` (UNIQUE) |
| `group_members` | User-to-group membership (with include/exclude) | `oid` | `(group_id, member_id)` (UNIQUE) |

---


## Settings Helpers (`src/lib/settings.ts`)

Server-side functions for reading settings with cascading resolution.

### Cascade Order

Settings resolve from most specific to least specific (first match wins):

1. **owner + form + domain** — e.g. frank + iPurchase + demo1
2. **owner + form + \*** — e.g. frank + iPurchase + any domain
3. **owner + "" + domain** — e.g. frank + no form + demo1
4. **owner + "" + \*** — e.g. frank + no form + any domain (global fallback)

`getSetting()` checks user-level first (all 4 cascade levels), then system-level (all 4 levels).

### Functions

```ts
import { getSetting, getSystemSetting, getUserSetting, getSettingBool, getSettingNumber } from "@/lib/settings";
```

**`getSetting(name, userId, opts?)`** — Full cascade: user first, then system.
```ts
const val = await getSetting("MAX_ROWS", "frank", { form: "iPurchase", domain: "demo1" });
// Checks: frank+iPurchase+demo1 → frank+iPurchase+* → frank+""+demo1 → frank+""+*
//   then: SYSTEM+iPurchase+demo1 → SYSTEM+iPurchase+* → SYSTEM+""+demo1 → SYSTEM+""+*
```

**`getSystemSetting(name, opts?)`** — System-level only (owner = 'SYSTEM').
```ts
const domains = await getSystemSetting("ALLOWED_DOMAINS");
// Checks: SYSTEM+""+*
const buyer = await getSystemSetting("DEFAULT_BUYER", { form: "Expense", domain: "demo1" });
// Checks: SYSTEM+Expense+demo1 → SYSTEM+Expense+* → SYSTEM+""+demo1 → SYSTEM+""+*
```

**`getUserSetting(name, userId, opts?)`** — User-level only.
```ts
const pref = await getUserSetting("THEME", "frank");
```

**`getSettingBool(name, userId, opts?)`** — Returns boolean. Truthy values: `true`, `yes`, `1`.
```ts
if (await getSettingBool("DARK_MODE", "frank")) { ... }
```

**`getSettingNumber(name, userId, opts?)`** — Returns number or null.
```ts
const limit = await getSettingNumber("PAGE_SIZE", "frank", { domain: "demo1" });
```

### Options

All functions accept an optional `opts` object:

| Option   | Default | Description |
|----------|---------|-------------|
| `form`   | `""`    | Form/context name for form-specific settings |
| `domain` | `"*"`   | Domain code for domain-specific settings |

### Database Table

Settings are stored in the `settings` table with natural key: `(owner, setting_name, domain, form)`.

| Column | Description |
|--------|-------------|
| `owner` | `'SYSTEM'` for global, or user_id for user-level |
| `setting_name` | Setting identifier |
| `domain` | Domain code or `'*'` for all domains |
| `form` | Form/context name or `''` for no form |
| `value` | Setting value (text) |
| `help_text` | Description of the setting |


## Lookup System (Autocomplete + Browse)

The Lookup component provides a searchable autocomplete dropdown with an optional full-screen browse modal. It replaces plain `<Select>` for any field that references another entity.

### Architecture

```
Lookup.tsx          ← Main component: text input + dropdown + browse button
LookupBrowseModal   ← Full-screen DataGrid modal for browsing all records
LookupTypes.ts      ← LookupConfig interface (data source, fields, display)
presets/             ← Pre-configured factories for common entities
```

### Using Lookup with useFieldHelper

```tsx
import { ActiveUserLookup } from "@/components/lookup/presets";

// In a detail component:
{field("supervisor_id", { type: "lookup", lookup: ActiveUserLookup() })}
{field("delegate_id", { type: "lookup", lookup: ActiveUserLookup() })}
{field("domains", { type: "lookup", lookup: DomainLookup({ multiple: true }) })}
```

### LookupConfig Interface

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `apiPath` | `string` | — | API path for server-side search (e.g. `/api/users`) |
| `fetchFn` | `(params) => Promise<{rows, total}>` | — | Custom fetch (overrides apiPath). For non-standard sources. |
| `valueField` | `string` | *required* | Field stored as the value (e.g. `"user_id"`) |
| `displayField` | `string` | *required* | Field shown in input when value selected |
| `displayFormat` | `(record) => string` | — | Custom text formatter for selected value |
| `searchColumns` | `string[]` | `[valueField, displayField]` | Fields searched when typing |
| `dropdownColumns` | `DropdownColumn[]` | `[valueField, displayField]` | Columns shown in dropdown rows |
| `dropdownLimit` | `number` | `10` | Max items in dropdown |
| `preload` | `boolean` | `false` | Load all results on mount (for small lists) |
| `browsable` | `boolean` | `true` | Show browse button for full-screen DataGrid |
| `gridColumns` | `ColumnDef[]` | — | Grid columns for browse modal |
| `multiple` | `boolean` | `false` | Multi-select mode (comma-separated values) |
| `baseFilters` | `Record<string, any>` | — | Filters always applied (e.g. `{ is_active: true }`) |
| `allOption` | `{ value, label }` | — | Prepend a wildcard/all option (e.g. `{ value: "*", label: "All" }`) |
| `onSelect` | `(record) => void` | — | Callback for cascading other fields on selection |

### Available Presets

| Preset | Source | Key features |
|--------|--------|--------------|
| `UserLookup()` | `/api/users` | Searches user_id, full_name, email. Has browse modal with grid. |
| `ActiveUserLookup()` | `/api/users` | Extends UserLookup with `baseFilters: { is_active: true }`. Use for supervisor, delegate, buyer. |
| `DomainLookup()` | `ALLOWED_DOMAINS` setting | Preloaded, no browse. Parses comma-separated setting value. |
| `GroupLookup()` | `/api/groups` | Preloaded. Shows `group_id — description` format. |
| `LocaleLookup()` | `/api/locales` | Preloaded. Shows flag icons in dropdown via `DropdownColumn` type. |

### Creating a Custom Preset

```typescript
// src/components/lookup/presets/VendorLookup.ts
import type { LookupConfig } from "../LookupTypes";

export const VendorLookup = (overrides?: Partial<LookupConfig>): LookupConfig => ({
  apiPath: "/api/vendors",
  valueField: "vendor_code",
  displayField: "vendor_name",
  searchColumns: ["vendor_code", "vendor_name"],
  gridColumns: [
    { key: "vendor_code", label: "Code" },
    { key: "vendor_name", label: "Name" },
    { key: "currency", label: "Currency" },
  ],
  placeholder: "Search vendors...",
  ...overrides,
});
```

Export from `presets/index.ts` and use in any page.

---

## Groups & Group Members

### Database Schema

**`groups`** — Group definitions for approval routing and permissions.
- `group_id` (citext, UNIQUE) — Group identifier
- `description` (citext) — Human-readable description

**`group_members`** — Flat membership table (no nested groups).
- `group_id` (citext, NOT NULL) — References groups
- `member_id` (citext, NOT NULL) — User ID
- `is_excluded` (boolean, DEFAULT false) — TRUE = user is excluded from group (for Can-Do list `!user` semantics)
- UNIQUE constraint on `(group_id, member_id)`

### GroupsPage

The Groups page uses a tabbed detail form with two tabs:

1. **General** — `group_id` (read-only after creation) and `description`
2. **Members** — Interactive user checklist

The Members tab reads/writes the `group_members` table via `/api/group_members`. It features:
- Alphabetically sorted user checklist with checkboxes
- Select All / Deselect All buttons
- Optimistic updates (checkbox toggles immediately, API call in background)
- Stable sort order (doesn't jump when toggling)
- Hidden for unsaved (new) groups

### UserGroupsField (on Users page)

The Users page includes a `UserGroupsField` component on the Profile tab that shows which groups a user belongs to. It uses a multi-select `GroupLookup` to read/write `group_members` records for the selected user.

- Reads: `GET /api/group_members?search={user_id}&limit=100`
- Adds: `POST /api/group_members` with `{ group_id, member_id: user_id }`
- Removes: `DELETE /api/group_members?oid={oid}`
- Hidden for unsaved (new) users

---

## Anti-Patterns — DO NOT

- Hand-roll AppShell + DataGrid + detail layouts — use CrudPage scaffold
- Hand-roll CRUD API routes — use `createCrudRoutes()` factory
- Put CRUD logic in page components — pages are config-only (title, apiPath, columns, renderDetail)
- Define TypeScript types that duplicate DB schema — use `{ oid: string; [key: string]: any }`
- Define `fetchPage`, `emptyRow`, `deleteLabel`, `gridId`, `exportConfig` in page config — CrudPage auto-derives all of these from `apiPath`
- Manually list all grid columns — let auto-discovery handle it, only override what's custom
- Use `String()` to wrap field values in JSX — use `?? ""` or `?? 0` to handle null/undefined
- Add manual `render` functions for standard number/boolean/date formatting — DataGrid auto-formats by type
- Hardcode validation messages — use `t("validation.key", "Fallback")` with translations in DB
- Hardcode `required: true` on fields when the backend `requiredFields` array covers them — let auto-derivation handle it
- Write `<Field label={t("x","Y")}><Input value={row.x} onChange={v => onChange("x", v)} /></Field>` — use `useFieldHelper` and call `field("x")` instead
- Use anything other than `oid` as a primary key
- Use natural keys as primary keys — they become UNIQUE constraints
- Hardcode colors — use CSS custom properties
- Skip the 5 standard columns on any table (`oid`, `created_at`, `created_by`, `updated_at`, `updated_by`)
- Add created/updated fields to detail forms — the CrudPage footer handles it automatically
- Use nullable text columns — always use `NOT NULL DEFAULT ''` for text, `NOT NULL DEFAULT false` for booleans
- Use plain `text` for business columns — use `citext` for anything users search or filter on
- Use `LOWER()` or `ILIKE` hacks for case-insensitive matching — use `citext` columns instead
- Enforce uppercase in the database (triggers, CHECK constraints) — use `transforms` in `createCrudRoutes()`
- Interpolate user input into SQL — use parameterized queries
- Set `updated_at` manually — the trigger handles it
- Return 200 from POST — use 201 for creation
- Use different names for table vs nav key vs API route vs gridId — they must all match the table name

---

## Internationalization (i18n)

### Architecture Overview

The i18n system is database-driven with a React context that provides reactive translations. Locale switching is instant (no page reload) and persists across sessions.

```
User refreshes → AuthProvider fetches GET /api/auth/me → user.locale
  → LocaleFromAuth passes locale to TranslationProvider
    → TranslationProvider fetches GET /api/translations/bundle?locale=fr
      → All components re-render with translated strings
```

### Key Files

| File | Purpose |
|------|---------|
| `src/context/TranslationContext.tsx` | `TranslationProvider`, `useTranslation()`, `useT()` hooks |
| `src/context/LocaleFromAuth.tsx` | Bridges AuthContext locale → TranslationProvider |
| `src/context/AuthContext.tsx` | Fetches user profile (including locale) from `/api/auth/me` |
| `src/components/shell/LocalePicker.tsx` | Header locale switcher (flag + dropdown) |
| `src/components/ui/Flag.tsx` | Shared inline SVG flag component (works on Windows) |
| `src/components/ui/LocaleSelect.tsx` | Dropdown with flags for forms (used in user profile) |
| `src/app/api/translations/bundle/route.ts` | Returns flat `{ "namespace.key": "value" }` map for a locale |
| `src/lib/substitute.ts` | `{named}` parameter substitution for translated strings |
| `src/app/api/translations/inline/route.ts` | PUT endpoint for inline translation editing |
| `src/app/api/users/locale/route.ts` | PUT endpoint to persist user's locale preference |
| `src/app/api/auth/me/route.ts` | Returns authenticated user's profile including saved locale |

### Database Tables

**`locales`** — Language definitions
- `code` (text, UNIQUE) — e.g. `en-us`, `fr`, `ja`
- `description` (text) — e.g. `English (US)`, `French`
- `date_format`, `number_format`, `is_active`

**`translations`** — All translated strings
- `locale` (text) — locale code
- `namespace` (text) — grouping key (e.g. `users`, `nav`, `crud`)
- `key` (text) — field key within namespace (e.g. `full_name`, `save`)
- `value` (text) — translated string
- UNIQUE constraint on `(locale, namespace, key)`

### How to Use Translations in Components

```typescript
import { useT } from "@/context/TranslationContext";

function MyComponent() {
  const t = useT();
  return <span>{t("users.full_name", "Full Name")}</span>;
  //                ^^ namespace.key    ^^ fallback (English)
}
```

**Rules:**
- Always provide an English fallback as the second argument
- Key format: `namespace.key` (e.g. `users.email`, `nav.settings`, `crud.save`)
- The fallback ensures the UI is always readable, even before translations load

**Parameterized translations:**

The `t()` function accepts an optional third argument for `{named}` parameter substitution:

```typescript
// Simple key
t("crud.save", "Save")

// With parameters — {record} and {title} are replaced at runtime
t("crud.confirm_delete", 'Delete "{record}"?', { record: row.name })
t("crud.search_placeholder", "Search {title}...", { title: pageTitle })
t("message.field_required", "{field} is required", { field: "Email" })
```

Translation values in the database use `{paramName}` placeholders:
- `en-us`: `Delete "{record}"?`
- `it-it`: `Eliminare "{record}"?`
- `ja`: `「{record}」を削除しますか？`

Substitution is handled by `src/lib/substitute.ts` — a simple `{key}` → value replacer used by both frontend `t()` and backend `translateMessage()`.

### Making Dynamic Content Reactive to Locale Changes

When labels are computed in `useMemo` or module-level constants, they won't update when the locale changes. Fix:

**Problem — module-level constant (not reactive):**
```typescript
// ❌ BAD: Never re-evaluates when locale changes
const COLUMNS = [
  { key: "name", label: "Name" },
];
```

**Solution — inside component with `useMemo([t])`:**
```typescript
// ✅ GOOD: Re-computes when translations change
function MyPage() {
  const t = useT();
  const columns = useMemo(() => [
    { key: "name", label: t("my_table.field.name", "Name") },
  ], [t]);
}
```

**Same pattern for nav items, extra actions, tab definitions** — anything with user-visible labels must have `t` in its dependency array.

### Sub-Components Need Their Own `useT()`

React hooks must be called at the top level of each component. If a parent and child both need `t()`, each must call `useT()` independently:

```typescript
// ❌ BAD: t is not defined in this scope
function ChildComponent() {
  return <span>{t("key", "fallback")}</span>;
}

// ✅ GOOD: Each component calls the hook
function ChildComponent() {
  const t = useT();
  return <span>{t("key", "fallback")}</span>;
}
```

### Locale Persistence Flow

1. **User changes language** via LocalePicker or profile form
2. `setLocale(code)` updates TranslationContext immediately (instant UI switch)
3. `PUT /api/users/locale` persists the choice to the `users` table
4. **On next refresh/login**: `GET /api/auth/me` returns saved `locale`
5. `LocaleFromAuth` passes it to `TranslationProvider` as `defaultLocale`
6. `TranslationProvider` syncs via `useEffect([defaultLocale])` when auth loads

### Adding a New Locale

1. Insert into `locales` table: `INSERT INTO locales (code, description) VALUES ('xx', 'Language Name')`
2. Add translations to `translations` table for all namespaces/keys
3. Add flag SVG to `src/components/ui/Flag.tsx`
4. The locale automatically appears in LocalePicker and LocaleSelect

### Adding Translations for a New Page

When creating a new CRUD page, add translation keys for:
- Column labels: `{table}.field.{column_name}` (e.g. `my_table.field.name`)
- Section titles: `{table}.section_{name}` (e.g. `my_table.section_general`)
- Any custom labels: `{table}.{descriptive_key}`

Insert for all active locales:
```sql
INSERT INTO translations (locale, namespace, key, value) VALUES
  ('en-us', 'my_table', 'field.name', 'Name'),
  ('fr',    'my_table', 'field.name', 'Nom'),
  -- ... for each locale
```

### Column Label Translations (CRITICAL)

**Every column** visible in the grid needs a `{table}.field.{column}` translation for each of the 16 locales. This includes the 4 audit columns that appear on every table.

**How it works:** `useSchemaDiscovery` fetches columns from `/api/columns?table={table}`, then resolves labels via `t("{table}.field.{column}", humanize(column))`. If no translation exists, the humanized fallback shows in English regardless of locale.

**Required for every CrudPage table** (16 locales × every column):
```
{table}.field.{column}          — one per column per locale
{table}.field.created_at        — "Created" / "Creato" / "Erstellt" / ...
{table}.field.created_by        — "Created By" / "Creato da" / ...
{table}.field.updated_at        — "Updated" / "Aggiornato" / ...
{table}.field.updated_by        — "Updated By" / "Aggiornato da" / ...
```

**When adding/removing a DB column:**
- Adding a column → add `{table}.field.{column}` translations for all 16 locales
- Removing a column → delete the corresponding translations
- Removing from route only → no translation cleanup needed (column still in DB)

**Active locales** (16): en-us, en-uk, es, de, fr, it-it, pt, nl, pl, ru, zh-cn, zh-tw, ja, ko, cs, he

### Shared Translation Namespaces

| Namespace | Used for | Examples |
|-----------|----------|----------|
| `crud` | CrudPage toolbar/scaffold | `crud.save`, `crud.delete`, `crud.new`, `crud.confirm_delete` |
| `nav` | Sidebar navigation labels | `nav.users`, `nav.settings`, `nav.approvals` |
| `grid` | DataGrid UI | `grid.search`, `grid.columns`, `grid.export` |
| `filter` | Advanced search | `filter.add_condition`, `filter.apply`, `filter.clear` |
| `users` | Users page fields | `users.full_name`, `users.email`, `users.cell_phone` |

### Flag Component

`<Flag code="fr" size={16} />` renders an inline SVG flag. Supported codes: `en-us`, `en-uk`, `es`, `fr`, `de`, `it-it`, `pt`, `nl`, `pl`, `ru`, `cs`, `ja`, `ko`, `zh-cn`, `zh-tw`, `he`. Unknown codes fall back to a globe icon.

Flags are SVG (not emoji) because Windows doesn't render flag emoji.

### LocaleSelect Component

For forms that need a language picker with flags:

```typescript
import { LocaleSelect } from "@/components/ui/LocaleSelect";

<LocaleSelect
  value={user.locale}
  onChange={v => onChange("locale", v)}
  options={localeOpts}  // { value: "fr", label: "fr — French" }[]
/>
```

Displays: 🇫🇷 French (flag + description, no code prefix).

---

