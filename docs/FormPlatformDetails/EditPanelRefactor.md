# CrudPanel Extraction & Component Architecture Refactor

## Problem Statement

The current codebase violates component reuse principles in two major ways:

1. **ChildGrid hand-rolls a `<table>`** instead of using DataGrid. It reimplements column rendering, row clicks, and loading states — none of the sorting, pagination, search, column management, or export that DataGrid provides.

2. **The edit panel pattern is copy-pasted.** CrudPage (713 lines) and ChildGrid (379 lines) both independently implement: CrudToolbar, error display, delete confirmation, form body rendering, dirty tracking, save/delete/copy handlers, notes panel, audit panel. The only difference is the container — one sits in a persistent right panel, the other in a SlidePanel.

This means bugs get fixed in one place but not the other, features added to one never reach the other, and the codebase grows linearly with each new edit scenario.

---

## Design Principles

These principles are non-negotiable:

### 1. CODE REUSE — NEVER COPY

Every time you are about to write a component, a handler, a piece of state management, or a UI pattern — STOP and ask: **does this already exist?**

- If it exists → USE IT.
- If it almost exists → EXTEND IT with a prop or callback.
- If it doesn't exist → BUILD IT ONCE, generically, so it never needs to be copied.

### 2. Components Own Their Own Concerns

Each component fetches what it needs. The parent doesn't shuttle data between siblings.

- **DataGrid** owns: schema discovery (colTypes via `/api/columns`), fetchPage, full-row fetch on select, column management, search, sort, pagination, export.
- **CrudPanel** owns: CRUD state, save/delete/copy handlers, dirty tracking, validation, empty row creation, notes, audit.
- **Page** owns: AppShell (nav, header, title, mobile chrome) + content slot. That's it.
- **SettingsPage** (or any page file) owns: which components go in the content area, how they're linked, page-specific config (columns, form body, defaultValues).

### 3. Everything Is a Panel

A **Panel** is the base concept — a container that renders children. Specific panels add behavior:

- **Panel** — base (stub for now, may gain shared behavior later)
- **CrudPanel extends Panel** — editing behavior: toolbar, save/delete/copy, dirty tracking, validation, notes, audit
- **InquiryPanel extends Panel** — (future) read-only display, no CRUD operations
- **SplitPanel extends Panel** — layout: two child slots with a draggable splitter
- **SlidePanel** — already exists: right-edge overlay drawer

No panel knows its container. A CrudPanel works identically in a SplitPanel's right slot, inside a SlidePanel overlay, or in a modal dialog.

### 4. A DataGrid is a DataGrid

Every grid in the system uses the DataGrid component. No hand-rolled `<table>` elements. A grid on a child tab is the same DataGrid used on a main browse — it just has a filter applied.

### 5. A Row is a Row

There is no concept of a "child row" vs a "main row." A row is a data object. A DataGrid provides rows. A CrudPanel consumes a row. The parent wires them together.

### 6. The Parent Declares Relationships

The parent (page file) says:
- "I want a Page with a SplitPanel"
- "Link this DataGrid to this CrudPanel"
- "Use this form body for editing"

It does NOT manually shuttle data, handle selection, or coordinate fetches.

---

## Publisher / Consumer Link Pattern

Components communicate through a **link** — a generic mechanism that connects a data publisher to one or more data consumers.

### Concepts

- **Publisher** — something that publishes row selections (e.g. DataGrid). Exposes `refresh()`.
- **Consumer** — something that receives row selections (e.g. CrudPanel). Exposes `canRelease(): Promise<boolean>`.
- **Link** (`useLink`) — connects them. Holds selection state. Coordinates dirty guards.

### The Link Does NOT Know About Components

It doesn't reference DataGrid or CrudPanel. It connects a publisher interface to a consumer interface. You could link two grids, a grid and a panel, anything.

### Flow

1. User clicks row in publisher (DataGrid)
2. DataGrid fetches the **full row** by oid (not just browse columns)
3. DataGrid fires `onSelect(oid, row)` with complete record
4. Link calls `canRelease()` on all consumers
5. All consumers say yes → link updates `selectedRow` → consumers receive it
6. Any consumer says no → nothing happens, selection stays

### Refresh Flow

- Consumer saves → link tells publisher to refresh (new/updated row appears in grid)
- Consumer deletes → link tells publisher to refresh + clears selection

### Interface

```typescript
interface DataPublisher {
  refresh: () => void;
}

interface DataConsumer {
  canRelease: () => Promise<boolean>;
}

// Hook
function useLink(publisherRef: RefObject<DataPublisher | null>, consumerRef: RefObject<DataConsumer | null>): {
  selectedRow: Record<string, any> | null;
  selectedId: string | null;
  isNew: boolean;
  onSelect: (oid: string, row: Record<string, any>) => void;
  onNew: () => void;
  onSaved: (row: Record<string, any>) => void;
  onDeleted: () => void;
}
```

### Page Usage

```tsx
// SettingsPage — declares components and links them
const link = useLink(gridRef, crudRef);

<Page title="System Settings">
  <SplitPanel
    left={<DataGrid ref={gridRef} table="settings" onSelect={link.onSelect} selectedId={link.selectedId} ... />}
    right={<CrudPanel ref={crudRef} row={link.selectedRow} isNew={link.isNew} onSaved={link.onSaved} onDeleted={link.onDeleted} onNew={link.onNew} ... />}
  />
</Page>
```

---

## Dirty-Cascade Pattern

CrudPanels can be nested arbitrarily deep (main record → child tab → grandchild tab → ...). When the user tries to switch rows at ANY level, the entire subtree must be consulted.

### canRelease()

Every CrudPanel exposes via ref:

```typescript
interface CrudPanelRef {
  /** Can this panel (and all its descendant CrudPanels) safely release their current row? */
  canRelease(): Promise<boolean>;
}
```

### Recursive Logic

When a selection change is requested:

1. Link calls consumer's `canRelease()`
2. CrudPanel checks: am I dirty?
   - If dirty → show confirm dialog → user says "discard" → continue, user says "cancel" → return false
   - If clean → continue
3. CrudPanel calls `canRelease()` on each registered child CrudPanel
4. If ANY child returns false → return false (bubble up, block the switch)
5. Only when the entire tree returns true does the selection change

### Child Registration

When a CrudPanel renders another CrudPanel (in a tab, in a SlidePanel, wherever), the child registers its `canRelease` with the parent. This happens via context:

```typescript
const CrudPanelContext = createContext<{
  registerChild: (id: string, ref: CrudPanelRef) => void;
  unregisterChild: (id: string) => void;
} | null>(null);
```

Each CrudPanel:
- Publishes a CrudPanelContext for its children
- Registers itself with its parent's CrudPanelContext (if one exists)
- On `canRelease()`: checks self, then iterates registered children

This means a CrudPanel 4 levels deep works identically to one at the top level. No special wiring. The tree builds itself.

### Example: 4-Level Deep Dirty Check

```
User clicks new row in top DataGrid
→ Link calls crudPanel.canRelease()
  → CrudPanel: I'm clean ✓
  → CrudPanel calls childCrudPanel.canRelease()
    → ChildCrudPanel: I'm clean ✓
    → ChildCrudPanel calls grandchildCrudPanel.canRelease()
      → GrandchildCrudPanel: I'm DIRTY ✗
      → Shows confirm → user says "Discard"
      → Returns true ✓
    → Returns true ✓
  → Returns true ✓
→ Selection changes, whole tree re-renders
```

---

## Component Responsibilities

### Page (base)

Page = AppShell. That's it.

- Nav, header, title, mobile back button
- Content slot for whatever the page file wants
- Knows nothing about grids, panels, CRUD, or data

### DataGrid (self-sufficient)

DataGrid owns all its own data concerns:

- **Schema discovery**: fetches colTypes/colScales from `/api/columns?table=X`
- **fetchPage**: builds generic `GET /api/{table}?offset=&limit=&search=&sort=&dir=&filters=`
- **Full row fetch on select**: when user clicks row, fetches `GET /api/{table}?oid=X&limit=1`, then fires `onSelect(oid, fullRow)`
- **Everything else it already does**: columns, sorting, search, pagination, export, column management

DataGrid's `onSelect` signature: `(oid: string, row: T) => void`

Publisher interface: exposes `refresh()` via ref.

### CrudPanel (self-sufficient)

CrudPanel owns all editing concerns:

- **CRUD state**: form, isDirty, saving, error
- **Handlers**: save (POST/PUT), delete, copy
- **Empty row creation**: builds blank row from its own schema knowledge, merges `defaultValues` prop
- **Dirty tracking + canRelease()**: including cascade to children
- **Toolbar**: CrudToolbar with notes/audit/extra actions
- **Validation**: DOM-based required field validation
- **Notes + Audit panels**
- **beforeunload guard**

Consumer interface: exposes `canRelease()` via ref.

### SplitPanel

Layout only. Two slots, draggable splitter, localStorage persistence. Extends Panel. Doesn't know what its children are.

---

## Current Architecture

```
CrudPage (713 lines) — monolith containing:
├── Page layout (AppShell, splitter, mobile responsive)
├── DataGrid configuration & rendering
├── Schema bootstrap (colTypes, colScales, requiredFields)
├── CRUD state (form, isDirty, isNew, saving, error)
├── CRUD handlers (save, delete, copy, new, select)
├── Dirty-form guard (confirmDiscard, beforeunload)
├── CrudToolbar rendering
├── Error / InlineConfirm rendering
├── Form body rendering (detailBody via renderDetail/renderTabs)
├── AuditFooter
├── NotesPanel
└── AuditPanel

ChildGrid (379 lines) — copy-paste of above:
├── Hand-rolled <table> (NOT DataGrid)
├── Own CRUD state (editingRow, isDirty, isNewChild, error)
├── Own CRUD handlers (save, delete, copy)
├── Own CrudToolbar rendering
├── Own error / InlineConfirm rendering
├── Own form body rendering (fieldLayouts loop)
├── Own design mode state + toolbar + HeaderTabContent
├── Own property panels (FieldProperties, SectionProperties, etc.)
├── NotesPanel
└── AuditPanel
```

**Pages using CrudPage (8 total):**
- Settings, Translations, Locales, PasoeBrokers — simple, use `renderDetail`
- UsersPage, GroupsPage — tabbed, use `renderTabs`
- EntityDesigner — tabbed, uses `renderTabs`
- FormPage — metadata-driven, wraps CrudPage with `renderTabs`, uses ChildGrid for child tables

---

## Target Architecture

### Building Blocks

```
Page — AppShell wrapper, content slot
├── Knows: nav, header, title, mobile chrome
└── Knows nothing about: grids, panels, CRUD, data

Panel (base — stub for now)
├── CrudPanel — editing behavior (self-sufficient)
│   ├── CRUD state, handlers, dirty tracking
│   ├── canRelease() + child cascade via CrudPanelContext
│   ├── Toolbar, validation, notes, audit
│   ├── Empty row creation from schema + defaultValues
│   └── Form body slot (renderBody callback)
│
├── InquiryPanel (future — read-only)
│
├── SplitPanel — layout only (two slots + splitter)
│
└── SlidePanel (exists — overlay drawer)

DataGrid (self-sufficient)
├── Schema discovery (fetches own colTypes)
├── fetchPage (builds own API calls)
├── Full row fetch on select
├── onSelect(oid, row) — publishes complete record
└── refresh() — publisher interface via ref

useLink — generic publisher/consumer connector
├── Holds selection state (selectedRow, isNew)
├── Coordinates canRelease dirty guards
├── Provides onSelect, onSaved, onDeleted, onNew
└── Component-agnostic (doesn't know DataGrid or CrudPanel)
```

### Page Composition Pattern

A page file declares what goes where and links them:

```tsx
// SettingsPage
export default function SettingsPage({ activeNav, onNavigate }) {
  const gridRef = useRef<DataPublisher>(null);
  const crudRef = useRef<CrudPanelRef>(null);
  const link = useLink(gridRef, crudRef);

  return (
    <Page title="System Settings" activeNav={activeNav} onNavigate={onNavigate}>
      <SplitPanel
        storageKey="settings"
        left={
          <DataGrid
            ref={gridRef}
            table="settings"
            columns={COLUMNS}
            onSelect={link.onSelect}
            selectedId={link.selectedId}
          />
        }
        right={
          <CrudPanel
            ref={crudRef}
            tableName="settings"
            apiPath="/api/settings"
            row={link.selectedRow}
            isNew={link.isNew}
            onSaved={link.onSaved}
            onDeleted={link.onDeleted}
            onNew={link.onNew}
            defaultValues={{ owner: "SYSTEM", domain: "*" }}
            renderBody={(props) => <SettingsForm {...props} />}
          />
        }
      />
    </Page>
  );
}
```

### Child Table Pattern

Same components, different container:

```tsx
// Inside a parent CrudPanel's renderBody, on a "Lines" tab:
const childGridRef = useRef<DataPublisher>(null);
const childCrudRef = useRef<CrudPanelRef>(null);
const childLink = useLink(childGridRef, childCrudRef);

<DataGrid
  ref={childGridRef}
  table="order_lines"
  parentFilter={{ oid_orders: parentOid }}
  onSelect={childLink.onSelect}
  selectedId={childLink.selectedId}
/>
<SlidePanel open={!!childLink.selectedRow || childLink.isNew}>
  <CrudPanel
    ref={childCrudRef}
    tableName="order_lines"
    apiPath="/api/order_lines"
    row={childLink.selectedRow}
    isNew={childLink.isNew}
    onSaved={childLink.onSaved}
    onDeleted={childLink.onDeleted}
    onNew={childLink.onNew}
    savePayloadExtras={{ oid_orders: parentOid }}
    renderBody={(props) => <LineForm {...props} />}
  />
</SlidePanel>
```

Child CrudPanel auto-registers with parent CrudPanel via CrudPanelContext. Dirty cascade just works.

### Recursive Nesting

Same pattern at every level:

```
Page
  SplitPanel
    DataGrid (orders)                    ← publisher
    CrudPanel (order editing)            ← consumer, canRelease cascades
      Tab: "Lines"
        DataGrid (order_lines, filtered) ← publisher
        SlidePanel
          CrudPanel (line editing)       ← consumer, canRelease cascades
            Tab: "Allocations"
              DataGrid (allocations)     ← publisher
              SlidePanel
                CrudPanel (alloc editing) ← leaf consumer
```

---

## File Changes Summary

### New Files
- `src/components/panels/Panel.tsx` — base stub ✅
- `src/components/panels/CrudPanel.tsx` — core editing component ✅
- `src/components/panels/CrudPanelContext.tsx` — dirty-cascade registration ✅
- `src/components/panels/SplitPanel.tsx` — layout with splitter ✅
- `src/components/panels/InlineConfirm.tsx` — delete confirmation ✅
- `src/components/panels/AuditFooter.tsx` — timestamps footer ✅
- `src/components/panels/index.ts` — barrel export ✅
- `src/hooks/useLink.ts` — publisher/consumer connector (TODO)
- `src/components/Page.tsx` — AppShell wrapper (TODO)

### Modified Files
- `src/components/data-grid/DataGrid.tsx` — add self-sufficient schema fetch, fetchPage, full-row-on-select, publisher ref
- `src/components/panels/CrudPanel.tsx` — add self-sufficient schema fetch, emptyRow creation
- `src/components/pages/*.tsx` — migrate to new pattern (one at a time)

### Deleted Files (eventually)
- `src/components/pages/FormPage/ChildGrid.tsx`
- `src/components/crud-page/CrudPage.tsx`

---

## Risk Mitigation

- **All new components built first without touching existing code.** ✅
- **Pages migrated one at a time.** Settings first as proof of concept.
- **Each step is independently testable.** Don't proceed until current step verified.
- **DataGrid changes are additive** — new props/behavior, existing usage unchanged.

---

## Decision Log

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Who owns beforeunload guard? | CrudPanel | It knows if form is dirty |
| 2 | Who fetches colTypes/colScales? | Each component fetches its own | Components own their concerns |
| 3 | Who renders empty state? | CrudPanel via renderEmpty prop | Consistent behavior everywhere |
| 4 | Who owns mobile layout? | Page file (parent) | Layout concern |
| 5 | Who owns grid column designer? | DataGrid | Grid display concern |
| 6 | Who owns field layout designer? | CrudPanel | Form display concern |
| 7 | Is there a CrudPage component? | No. Pages compose Page + SplitPanel + DataGrid + CrudPanel | No abstraction layer needed |
| 8 | Panel base class? | Stub for now | CrudPanel and InquiryPanel inherit |
| 9 | How do nested CrudPanels cascade dirty checks? | canRelease() via ref + CrudPanelContext registration | Recursive, works at any depth |
| 10 | Who fetches fetchPage? | DataGrid builds its own from table name | Identical for every table |
| 11 | Who builds empty row? | CrudPanel from its schema + defaultValues prop | Page just passes defaults |
| 12 | How do DataGrid and CrudPanel coordinate? | useLink hook — generic publisher/consumer | Component-agnostic, page declares the link |
| 13 | What does DataGrid send on select? | oid + full row (fetches complete record) | Consumer shouldn't re-fetch |
| 14 | What is Page? | AppShell wrapper with content slot | Knows nothing about data or CRUD |
