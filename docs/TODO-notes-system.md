# Notes & Notifications System — Implementation Plan

## Overview

A record-level conversation thread with @mentions, file attachments, and real-time notifications. Attaches to any CrudPage screen automatically via `table_name` + `record_oid` (same pattern as audit trail).

---

## Database Tables

### `notes`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| table_name | citext NOT NULL | Which table this note belongs to |
| record_oid | UUID NOT NULL | Which record (links via oid) |
| body | text NOT NULL | Note content (plain text with @mentions) |
| author | citext NOT NULL | user_id of who wrote it |
| created_at | TIMESTAMPTZ | Standard audit column |
| created_by | citext | Standard audit column |
| updated_at | TIMESTAMPTZ | Standard audit column |
| updated_by | citext | Standard audit column |
| oid | UUID | Standard audit column |

Indexes: `(table_name, record_oid, created_at DESC)`, `(author)`

### `note_attachments`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| note_id | BIGINT NOT NULL | FK → notes.id ON DELETE CASCADE |
| filename | citext NOT NULL | Original filename |
| mime_type | citext NOT NULL | e.g. application/pdf, image/png |
| file_data | BYTEA NOT NULL | The actual file bytes |
| file_size | INTEGER NOT NULL | Size in bytes |
| created_at | TIMESTAMPTZ | Standard audit column |
| created_by | citext | Standard audit column |
| updated_at | TIMESTAMPTZ | Standard audit column |
| updated_by | citext | Standard audit column |
| oid | UUID | Standard audit column |

Index: `(note_id)`

### `note_mentions`
| Column | Type | Notes |
|--------|------|-------|
| note_id | BIGINT NOT NULL | FK → notes.id ON DELETE CASCADE |
| user_id | citext NOT NULL | Who was @mentioned |

PK: `(note_id, user_id)`

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL PK | |
| user_id | citext NOT NULL | Recipient |
| note_id | BIGINT NOT NULL | FK → notes.id ON DELETE CASCADE |
| table_name | citext NOT NULL | For navigation (= nav key) |
| record_oid | UUID NOT NULL | For selecting the record |
| is_read | BOOLEAN NOT NULL DEFAULT FALSE | |
| deleted_at | TIMESTAMPTZ | Soft delete — NULL = active |
| created_at | TIMESTAMPTZ | Standard audit column |
| created_by | citext | Standard audit column |
| updated_at | TIMESTAMPTZ | Standard audit column |
| updated_by | citext | Standard audit column |
| oid | UUID | Standard audit column |

Indexes: `(user_id, is_read, deleted_at)` for the poll query, `(note_id)`

---

## API Endpoints

### Notes CRUD — `/api/notes`

| Method | Params | Description |
|--------|--------|-------------|
| GET | `table`, `oid`, `offset`, `limit` | Fetch notes for a record (oldest first, chat-style) |
| POST | body: `{ table_name, record_oid, body, mentions: string[] }` | Create note, parse @mentions, create notifications |
| DELETE | `id` | Delete own note only (author must match current user). Cascades to attachments, mentions, notifications |

### Attachments — `/api/notes/attachments`

| Method | Params | Description |
|--------|--------|-------------|
| POST | FormData: `note_id`, `file` | Upload attachment to existing note |
| GET | `id` | Download attachment (returns file bytes with correct content-type) |

### Notifications — `/api/notifications`

| Method | Params | Description |
|--------|--------|-------------|
| GET `/api/notifications/count` | — | Unread count for current user (polled every 5s) |
| GET `/api/notifications` | `offset`, `limit` | List notifications for current user (unread first, then read, exclude deleted) |
| PUT `/api/notifications/read` | body: `{ id }` or `{ all: true }` | Mark one or all as read |
| DELETE `/api/notifications` | `id` | Soft-delete a notification (sets deleted_at) |

---

## Frontend Components

### NotesPanel (`src/components/notes-panel/NotesPanel.tsx`)

Slide-in panel from right (same as AuditPanel pattern) but **stays open** until explicitly closed.

**Props**: `table: string`, `recordOid: string`, `open: boolean`, `onClose: () => void`

**Layout**:
- Header: message icon, "Notes" title, note count badge, close button
- Body: scrollable chat-style timeline (oldest at bottom of scroll, newest visible)
  - Each note: author avatar/initial, author name, timestamp, body text, attachments
  - @mentions highlighted in the body text
  - Delete button (trash icon) on own notes only
  - Attachment chips: filename + size, click to download
- Footer (pinned): compose area
  - Text input (textarea, auto-grows)
  - @ trigger: typing `@` opens user search dropdown
  - Attach button (paperclip icon): file picker
  - Send button

### CrudPage Integration

- Auto-inject "Notes" button in toolbar (message icon) when `exportConfig.table` is set
- Badge on the button showing note count for current record
- NotesPanel rendered as fixed overlay (like AuditPanel)
- Fetch note count when record is selected (lightweight `GET /api/notes?table=x&oid=y&count_only=true`)

### NotificationBell (`src/components/shell/NotificationBell.tsx`)

Lives in the header, next to the user's name.

- Bell icon with unread count badge (red dot with number)
- Polls `GET /api/notifications/count` every 5 seconds
- Click opens dropdown panel:
  - List of notifications, newest first
  - Each item: "[Author] mentioned you on [Screen Label] > [Record Title]" + timestamp
  - Unread items have bold styling / accent left border
  - Click → navigate to screen (using table_name as nav key) + select record + open Notes panel
  - "Mark all read" button at top
  - Delete (X) button on each notification
- Dropdown closes on outside click

---

## Implementation Order

### Phase 1: Database + API
- [ ] Migration script `004_notes.py` — all 4 tables, indexes, triggers
- [ ] `POST /api/notes` — create note, parse mentions, create notifications
- [ ] `GET /api/notes` — fetch notes for a record
- [ ] `DELETE /api/notes` — delete own note (cascade)
- [ ] `POST /api/notes/attachments` — upload file
- [ ] `GET /api/notes/attachments?id=` — download file
- [ ] `GET /api/notifications/count` — unread count
- [ ] `GET /api/notifications` — list notifications
- [ ] `PUT /api/notifications/read` — mark read
- [ ] `DELETE /api/notifications` — soft delete

### Phase 2: Notes Panel
- [ ] NotesPanel component — slide-in, chat timeline, compose area
- [ ] @mention user picker (search users table)
- [ ] File attachment upload + download
- [ ] Delete own notes
- [ ] CrudPage integration — auto-inject Notes button with badge

### Phase 3: Notification Bell
- [ ] NotificationBell component in header
- [ ] Poll for unread count every 5s
- [ ] Dropdown with notification list
- [ ] Click-to-navigate: go to screen + record + open Notes
- [ ] Mark read / delete

### Phase 4: Polish
- [ ] Scroll to bottom on new note
- [ ] Loading states and error handling
- [ ] Empty state ("No notes yet — start the conversation")
- [ ] Mobile responsiveness for panel
- [ ] Update ARCHITECTURE.md with Notes system docs

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Panel vs tab | Slide-in panel (stays open) | Can view notes while working on the form |
| File storage | BYTEA in PostgreSQL | Consistent with iPurchase BLOB pattern, simple backup |
| Note editing | Not allowed | Notes are a record of conversation, like chat |
| Note deletion | Author only | Users can clean up their own mistakes |
| Notification delivery | Polling every 5s | Simple, tiny payload (just a count), no WebSocket complexity |
| Notification deletion | Soft delete (deleted_at) | Can undelete if needed, doesn't break FK chains |
| Navigation | table_name = nav key | One-name-everywhere convention, no mapping needed |
| @mention storage | Junction table | Clean queries for "who was mentioned" and "notes mentioning me" |
| Note ordering | Oldest first (chat-style) | Natural conversation flow, newest at bottom |
