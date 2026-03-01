# iSolutions Architecture & Development Patterns

> **This document is the single source of truth for AI assistants building iSolutions pages.**
> Read it BEFORE writing any code. Follow every pattern exactly.

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
│   │   │   └── PasoeBrokers.tsx
│   │   ├── shell/                         # AppShell, Header, Sidebar
│   │   ├── theme/                         # ThemeProvider, ThemeToggle
│   │   └── ui/index.tsx                   # Primitives: Section, Field, Input, Select, Checkbox, Badge, TabBar
│   ├── context/AuthContext.tsx
│   ├── hooks/useIsMobile.ts
│   └── lib/
│       ├── db.ts                          # PostgreSQL pool (node-pg singleton)
│       ├── config.ts                      # Environment config
│       └── filter-sql.ts                  # Advanced filter → parameterized SQL
├── scripts/migrate/                       # Numbered Python migration scripts
│   ├── 001_initial.py                     # Users table, sessions, etc.
│   ├── 002_audit_columns.py              # Adds 5 audit columns to all tables
│   └── 003_audit_log.py                  # Audit trail table + triggers
└── docs/ARCHITECTURE.md                   # ← YOU ARE HERE
```

---

## Database Standards

### Every table MUST have these 5 audit columns

| Column       | Type        | Default               | Purpose                                    |
|--------------|-------------|-----------------------|--------------------------------------------|
| `oid`        | UUID        | `gen_random_uuid()`   | Immutable unique ID. UNIQUE constraint.    |
| `created_at` | TIMESTAMPTZ | `NOW()`               | Row creation timestamp                     |
| `created_by` | citext      | `''`                  | User who created the row                   |
| `updated_at` | TIMESTAMPTZ | `NOW()`               | Auto-set by trigger on every UPDATE        |
| `updated_by` | citext      | `''`                  | User who last modified the row             |

### Database rules

- Use `citext` for ALL text columns (case-insensitive by default).
- The `set_updated_at()` trigger auto-updates `updated_at` — never set it manually in SQL.
- API routes MUST set `created_by` and `updated_by` from the authenticated user.
- Primary keys: natural key where one exists (e.g. `user_id`), otherwise `SERIAL id` + the `oid` UUID.
- All new tables get a migration in `scripts/migrate/NNN_description.py` (Python, idempotent).
- Table names: `snake_case`, descriptive names (e.g. `pasoe_brokers`, `users`, `audit_log`).
- **One name everywhere**: The table name IS the nav key, API route folder, and grid ID. Example: table `pasoe_brokers` → nav key `pasoe_brokers`, API at `/api/pasoe_brokers`, `gridId: "pasoe_brokers"`. This eliminates mapping tables and keeps navigation, notifications, and audit trail simple.

### Migration script pattern

```python
#!/usr/bin/env python3
# scripts/migrate/NNN_description.py
# Idempotent: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS
# Always include the 5 audit columns (oid, created_at, created_by, updated_at, updated_by)
# Always create the set_updated_at trigger for the table
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
- Audit button + panel: auto-wired when `exportConfig.table` is set
- Desktop: grid starts expanded, collapses to 420px when a record is selected
- Mobile: full-screen grid → full-screen detail with back arrow
- All state management: selection, dirty tracking, save/delete/new/copy handlers

### How to create a new CRUD page

#### Step 1: Define your row type

```typescript
// The row type MUST have an `id: string` field — CrudPage uses it for selection.
// Include `oid: string` for audit trail support.
// Map your primary key to `id` in the fetchPage/fetchOne functions.
type MyRow = {
  id: string;
  oid: string;
  name: string;
  // ... your fields
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
};
```

#### Step 2: Create the CrudPageConfig

```typescript
const config: CrudPageConfig<MyRow> = {
  // ── Page metadata ──
  title: "My Entity",
  emptyIcon: "server",                    // Icon name (see Icon Reference below)
  emptyText: "Select a record",
  detailTitle: (row) => row.name,         // Shown in mobile detail header

  // ── DataGrid ──
  columns: [
    { key: "name", header: "Name", locked: true },
    { key: "status", header: "Status", render: (v) => <Badge variant={...}>{v}</Badge> },
  ],
  // Note: created_at, created_by, updated_at, updated_by are auto-injected — don't add them
  defaultVisible: ["name", "status"],
  fetchPage: async ({ offset, limit, search, sort, dir, filters }) => {
    const params = new URLSearchParams({ offset, limit, search, sort, dir, filters });
    const res = await fetch(`/api/myentity?${params}`);
    const data = await res.json();
    return { rows: data.rows.map(r => ({ ...r, id: String(r.id) })), total: data.total };
  },
  searchPlaceholder: "Search...",
  gridId: "myentity",                     // For persisting column preferences
  colTypesUrl: "/api/myentity/columns",
  exportConfig: { table: "my_table", searchFields: ["name"], filename: "myentity" },
  // ↑ exportConfig.table also drives the audit button + panel automatically

  // ── Mobile card renderer ──
  renderCard: (row, isSelected) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon name="server" size={20} />
      <div>
        <div style={{ fontWeight: 600 }}>{row.name}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.status}</div>
      </div>
    </div>
  ),

  // ── Detail panel (choose ONE) ──
  // Option A: Simple form (CrudPage wraps in scrollable container)
  renderDetail: ({ row, onChange }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <Section title="General">
        <Field label="Name" required>
          <Input value={row.name} onChange={v => onChange({ ...row, name: v })} />
        </Field>
      </Section>
    </div>
  ),
  // Option B: Tabs (you own the scroll area; set renderDetail: () => null)
  // renderTabs: ({ row, onChange }) => <MyTabbedForm row={row} onChange={onChange} />,

  // ── Extra toolbar actions ──
  extraActions: [
    { key: "notes", icon: "messageSquare", label: "Notes", onClick: () => {} },
  ],
  // Note: Audit button is auto-injected — don't add it manually

  // ── CRUD operations ──
  fetchOne: async (id) => {
    const res = await fetch(`/api/myentity?id=${id}`);
    const data = await res.json();
    return { ...data, id: String(data.id) };
  },
  create: async (row) => {
    const res = await fetch("/api/myentity", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(row) });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    return { ...data, id: String(data.id) };
  },
  update: async (row) => {
    const res = await fetch("/api/myentity", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(row) });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    return { ...data, id: String(data.id) };
  },
  remove: async (row) => {
    await fetch(`/api/myentity?id=${row.id}`, { method: "DELETE" });
  },
  emptyRow: () => ({ id: "", oid: "", name: "", status: "", created_at: "", created_by: "", updated_at: "", updated_by: "" }),
  copyRow: (row) => ({ ...row, id: "", oid: "", name: row.name + " (copy)" }),
  isNewRow: (row) => !row.id,
  deleteLabel: (row) => row.name,

  // ── Validation ──
  validate: (row) => {
    if (!row.name?.trim()) return "Name is required";
    return null; // null = valid
  },
};
```

#### Step 3: Export the component

```typescript
export function MyPage({ activeNav, onNavigate }: {
  activeNav: string; onNavigate: (k: string) => void;
}) {
  const renderCard = useCallback((row: MyRow, sel: boolean) => (...), []);
  const config = useMemo<CrudPageConfig<MyRow>>(() => ({ ... }), [renderCard]);
  return <CrudPage config={config} activeNav={activeNav} onNavigate={onNavigate} />;
}
```

#### Step 4: Register in the router

In `src/app/page.tsx`:
```typescript
if (activeNav === "my_table") return <MyPage activeNav={activeNav} onNavigate={setActiveNav} />;
```

And add a nav entry in `src/components/shell/Sidebar.tsx`.

### renderDetail vs renderTabs

| Mode | When to use | Who owns scroll? |
|------|-------------|------------------|
| `renderDetail` | Simple form, no tabs | CrudPage wraps in `<div class="flex-1 overflow-y-auto p-4 sm:p-5">` |
| `renderTabs` | Tabbed interface | YOU own the scroll container. Render `<TabBar>` + your own scrollable content. |

When using `renderTabs`, set `renderDetail: () => null` (it's ignored but TypeScript wants it).

---

## API Route Pattern

Every entity needs **two** route files:

### 1. `/api/{entity}/route.ts` — Full CRUD

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildFilterWhere } from "@/lib/filter-sql";

const ALLOWED_COLUMNS = new Set(["id","name","domain","created_at","updated_at"]);
const COL_TYPES: Record<string,"text"|"number"|"boolean"|"date"|"datetime"> = {
  id: "number", created_at: "datetime", updated_at: "datetime",
};

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0"));
  const limit  = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
  const search = url.searchParams.get("search")?.trim() || "";
  const filtersJson = url.searchParams.get("filters") || "";
  const sortCol = url.searchParams.get("sort") || "name";
  const sortDir = url.searchParams.get("dir") === "desc" ? "DESC" : "ASC";
  const safeSort = ALLOWED_COLUMNS.has(sortCol) ? sortCol : "name";

  const conditions: string[] = [];
  const params: any[] = [];
  let pi = 1;

  if (search) {
    conditions.push(`("name"::text ILIKE $${pi} OR "domain"::text ILIKE $${pi})`);
    params.push(`%${search}%`); pi++;
  }
  if (filtersJson) {
    const fr = buildFilterWhere(filtersJson, pi, COL_TYPES, ALLOWED_COLUMNS);
    if (fr.sql) { conditions.push(fr.sql); params.push(...fr.params); pi = fr.nextIdx; }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countR = await db.query(`SELECT COUNT(*)::int AS total FROM my_table ${where}`, params);
  const dataR = await db.query(
    `SELECT * FROM my_table ${where}
     ORDER BY "${safeSort}" ${sortDir} LIMIT $${pi} OFFSET $${pi+1}`,
    [...params, limit, offset]
  );
  return NextResponse.json({ rows: dataR.rows, total: countR.rows[0].total, offset, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Validate required fields
  if (!body.name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const res = await db.query(
    `INSERT INTO my_table (name, domain, created_by, updated_by)
     VALUES ($1, $2, $3, $3) RETURNING *`,
    [body.name.trim(), body.domain || "", "current_user"]  // TODO: real auth user
  );
  return NextResponse.json(res.rows[0], { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await db.query(
    `UPDATE my_table SET name=$1, domain=$2, updated_by=$3
     WHERE id=$4 RETURNING *`,
    [body.name, body.domain, "current_user", body.id]  // TODO: real auth user
  );
  if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(res.rows[0]);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.query("DELETE FROM my_table WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
```

**Critical rules:**
- ALWAYS use parameterized queries (`$1`, `$2`) — NEVER interpolate user input into SQL
- ALWAYS whitelist sort columns via `ALLOWED_COLUMNS`
- ALWAYS use `buildFilterWhere()` from `@/lib/filter-sql.ts`
- POST/PUT MUST set `created_by` / `updated_by`
- POST returns **201**, PUT returns **200**, unique violations return **409**
- NEVER set `updated_at` in SQL — the trigger handles it

### 2. `/api/{entity}/columns/route.ts` — Column type metadata

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const res = await db.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'my_table' AND table_schema = 'public'
  `);
  const map: Record<string, string> = {};
  for (const r of res.rows) {
    const dt = r.data_type.toLowerCase();
    if (dt.includes("int") || dt.includes("numeric") || dt.includes("float")) map[r.column_name] = "number";
    else if (dt === "boolean") map[r.column_name] = "boolean";
    else if (dt.includes("timestamp")) map[r.column_name] = "datetime";
    else if (dt === "date") map[r.column_name] = "date";
    else map[r.column_name] = "text";
  }
  return NextResponse.json(map);
}
```

The DataGrid uses this to offer type-appropriate filter operators in AdvancedSearch.

---

## UI Component Reference

### Primitives (`@/components/ui`)

| Component  | Key Props | Notes |
|------------|-----------|-------|
| `Section`  | `title` | Groups fields with uppercase header |
| `Field`    | `label, required?` | Wraps input with label + required asterisk |
| `Input`    | `value, onChange?, readOnly?, type?, placeholder?` | onChange receives string value (not event) |
| `Select`   | `value, onChange, options: {value,label}[]` | onChange receives string value |
| `Checkbox` | `checked, onChange, label` | onChange receives boolean |
| `Badge`    | `variant: "success"\|"danger"\|"warning"\|"neutral"\|"info"` | Status pill |
| `TabBar`   | `tabs: TabDef[], active, onChange` | `TabDef = { key, label, icon? }` |

### Icons (`<Icon name="..." size={18} />`)

Available names: `menu`, `search`, `plus`, `save`, `trash`, `copy`, `key`, `download`, `upload`, `unlock`, `shield`, `users`, `user`, `settings`, `briefcase`, `clock`, `mail`, `lock`, `chart`, `chevUp`, `chevDown`, `chevRight`, `chevLeft`, `chevFirst`, `chevLast`, `x`, `check`, `sortAsc`, `sortDesc`, `tag`, `arrowLeft`, `server`, `activity`, `messageSquare`, `logOut`, `columns`, `filter`, `expand`, `collapse`, `eye`, `eyeOff`

### Styling rules

- **ALWAYS** use CSS custom properties for colors — `var(--text-primary)`, `var(--bg-surface)`, etc.
- **NEVER** hardcode colors (`#333`, `text-gray-500`, `rgb(...)`)
- Tailwind is OK for layout: `flex`, `gap-2`, `grid`, `px-4`, `rounded`, etc.
- Form grids: `className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4"`
- Theme handles light/dark automatically through CSS variables.

### Key theme tokens

```
Backgrounds: --bg-main, --bg-surface, --bg-surface-alt, --bg-selected
Text:        --text-primary, --text-secondary, --text-muted
Borders:     --border, --border-light
Accent:      --accent, --accent-hover
Status:      --danger-text
```

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
9. [ ] **Verify**: Grid loads, search works, select shows detail, save/new/delete/copy all work
10. [ ] **Verify audit**: Footer shows timestamps, Audit button opens panel, changes are tracked

---

## Current Tables

| Table | Purpose | Screen |
|-------|---------|--------|
| `users` | User accounts, profiles, permissions | UsersPage |
| `pasoe_brokers` | PASOE/QAD broker connection configs | PasoeBrokers |
| `audit_log` | Field-level change history (auto-populated by triggers) | AuditPanel (shared) |
| `sessions` | Auth sessions | — |
| `grid_prefs` | Per-user DataGrid column visibility prefs | — |

---

## Anti-Patterns — DO NOT

- Hand-roll AppShell + DataGrid + detail layouts — use CrudPage scaffold
- Put layout or state management code in page components — pages are config-only
- Hardcode colors — use CSS custom properties
- Skip audit columns on any table
- Add created/updated fields to detail forms — the CrudPage footer handles it automatically
- Add `auditConfig` to page configs — audit auto-derives from `exportConfig.table` + `row.oid`
- Manually define `created_at`/`created_by`/`updated_at`/`updated_by` grid columns — CrudPage auto-injects them
- Interpolate user input into SQL — use parameterized queries
- Set `updated_at` manually — the trigger handles it
- Create API routes without `ALLOWED_COLUMNS` whitelist
- Use `LIMIT` without `OFFSET` — always support pagination
- Forget the `/columns` route — DataGrid needs it for AdvancedSearch filter types
- Return 200 from POST — use 201 for creation
- Hardcode table names in audit-log API whitelist — it dynamically checks for triggers
- Use different names for table vs nav key vs API route vs gridId — they must all match the table name
