# Groups & Members — Feature Spec

## Overview

Dedicated Groups management page with nested group support. Groups can contain users and other groups, with transitive membership resolution via recursive queries.

## Data Model

### `groups` table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `group_id` | text | `''` | Natural key (UNIQUE) |
| `description` | text | `''` | |
| `is_active` | boolean | `true` | |
| `created_at` | timestamptz | `now()` | Standard audit |
| `created_by` | text | `''` | Standard audit |
| `updated_at` | timestamptz | `now()` | Standard audit |
| `updated_by` | text | `''` | Standard audit |
| `oid` | uuid | `gen_random_uuid()` | **PRIMARY KEY** |

### `group_members` table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `group_id` | text | `''` | FK-like reference to groups.group_id |
| `member_id` | text | `''` | user_id or group_id of the member |
| `member_type` | text | `'user'` | CHECK: `'user'` or `'group'` |
| `created_at` | timestamptz | `now()` | Standard audit |
| `created_by` | text | `''` | Standard audit |
| `updated_at` | timestamptz | `now()` | Standard audit |
| `updated_by` | text | `''` | Standard audit |
| `oid` | uuid | `gen_random_uuid()` | **PRIMARY KEY** |

UNIQUE constraint on `(group_id, member_id, member_type)`.

### Nested Group Resolution

Effective membership resolved via `WITH RECURSIVE` CTE. Circular reference prevention at application level.

## UI Design

- **Grid**: group_id, description, is_active, member count
- **Detail**: Tabbed — General (group_id, description, is_active) + Members (add/remove users and groups)
- **Members tab**: shows member_id, member_type, resolved name. Add/remove support.

## Nav Location

Sidebar → Administration → "Groups" (separate from "Users")

## Implementation Checklist

### Database
- [x] `groups` table created (tables live in DB)
- [x] `group_members` table created (tables live in DB)
- [x] `set_updated_at` triggers on both tables
- [ ] Recreate migration script `011_groups.py`
- [ ] Add both tables to `AUDITED_TABLES` in `003_audit_log.py` and re-run

### API
- [ ] `src/app/api/groups/route.ts`
- [ ] `src/app/api/groups/columns/route.ts`
- [ ] `src/app/api/group_members/route.ts`
- [ ] `src/app/api/group_members/columns/route.ts`

### Frontend
- [ ] `src/components/pages/GroupsPage.tsx`
- [ ] Router entry in `src/app/page.tsx`
- [ ] Sidebar entry in `src/components/shell/AppShell.tsx`

### Translations (16 locales)
- [ ] `groups.field.*` — group_id, description, is_active + 4 audit columns
- [ ] `group_members.field.*` — group_id, member_id, member_type + 4 audit columns
- [ ] `groups.section_general`, `groups.section_members`
- [ ] `nav.groups`

### Verification
- [ ] Grid, search, detail, save/new/delete/copy
- [ ] Members tab: add/remove users and groups
- [ ] Audit footer + panel
- [ ] i18n across all 16 locales
