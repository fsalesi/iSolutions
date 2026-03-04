# iSolutions — Active Work Context

**Read this file FIRST before writing any code.**

---

## Core Principle: CODE REUSE — NEVER COPY

Every time you are about to write a component, a handler, a piece of state management, or a UI pattern — STOP and ask: **does this already exist?**

- If it exists → USE IT.
- If it almost exists → EXTEND IT with a prop or callback.
- If it doesn't exist → BUILD IT ONCE, generically, so it never needs to be copied.

**NEVER** duplicate logic between components. **NEVER** create a "child" version of something that already exists as a "main" version. **NEVER** hand-roll a `<table>` when DataGrid exists. **NEVER** copy-paste CRUD handlers from one component to another.

If two components need the same behavior, extract that behavior into a shared component. Period.

---

## What We're Fixing

- **ChildGrid.tsx** (379 lines) is a hand-rolled copy of what CrudPage already does — duplicate CRUD state, duplicate handlers, duplicate toolbar, duplicate form rendering. It doesn't even use DataGrid.
- **CrudPage.tsx** (713 lines) is a monolith that mixes page layout, data fetching, schema bootstrap, CRUD logic, and UI rendering — making it impossible to reuse any single concern independently.

---

## The Architecture

### Components Own Their Own Concerns

- **Page** = AppShell. Nav, header, title, mobile chrome, content slot. Knows nothing about data, grids, or CRUD.
- **DataGrid** = self-sufficient. Fetches its own schema, builds its own fetchPage, fetches the full row on select, fires `onSelect(oid, row)`. Exposes `refresh()` via ref (publisher).
- **CrudPanel** = self-sufficient. Owns CRUD state, save/delete/copy, dirty tracking, validation, empty row creation (from schema + defaultValues), notes, audit. Exposes `canRelease()` via ref (consumer).
- **SplitPanel** = layout only. Two slots, draggable splitter. Doesn't know what its children are.
- **useLink** = generic publisher/consumer connector. Holds selection state. Coordinates dirty guards. Component-agnostic.

### Page Composition

A page file declares what goes where and links them:

```tsx
export default function SettingsPage({ activeNav, onNavigate }) {
  const gridRef = useRef<DataPublisher>(null);
  const crudRef = useRef<CrudPanelRef>(null);
  const link = useLink(gridRef, crudRef);

  return (
    <Page title="System Settings" activeNav={activeNav} onNavigate={onNavigate}>
      <SplitPanel storageKey="settings"
        left={<DataGrid ref={gridRef} table="settings" columns={COLUMNS} onSelect={link.onSelect} selectedId={link.selectedId} />}
        right={<CrudPanel ref={crudRef} tableName="settings" apiPath="/api/settings" row={link.selectedRow} isNew={link.isNew} onSaved={link.onSaved} onDeleted={link.onDeleted} onNew={link.onNew} defaultValues={{ owner: "SYSTEM", domain: "*" }} renderBody={(props) => <SettingsForm {...props} />} />}
      />
    </Page>
  );
}
```

There is no CrudPage. There is no intermediate wrapper. The page file composes building blocks.

### Key Architectural Rules

- **Page** = AppShell wrapper only. Content slot for whatever the page wants.
- **Everything is a Panel** — Panel (base stub), CrudPanel, InquiryPanel (future), SplitPanel, SlidePanel
- **Components fetch their own data** — DataGrid fetches schema + rows, CrudPanel fetches schema + builds empty rows
- **DataGrid** = displays rows. Doesn't know if it's "main" or "child." Just has a filter.
- **CrudPanel** = edits a row. Doesn't know its container. Just receives a row and renders.
- **useLink** = connects a publisher to a consumer. Doesn't know what they are.
- **A Row is a Row** — no "child row" concept. Data is data.
- **Dirty cascade** — canRelease() propagates through entire CrudPanel tree via CrudPanelContext

### Key Documents (read in this order):

1. **EditPanelRefactor.md** — Architecture, design principles, component interfaces, dirty cascade, publisher/consumer link pattern
2. **EditPanelRefactor-Tasks.md** — Detailed task checklist with phases and verification steps

### Phases:

| Phase | What | Status |
|-------|------|--------|
| 1 | Create Panel building blocks (Panel, CrudPanel, CrudPanelContext, SplitPanel) | Done |
| 2 | Make DataGrid self-sufficient (schema, fetchPage, full-row-on-select, publisher ref) | Not started |
| 3 | Make CrudPanel self-sufficient (schema fetch, emptyRow creation) | Not started |
| 4 | Build useLink hook + Page component | Not started |
| 5 | Migrate pages (Settings first, then rest) + delete CrudPage + delete ChildGrid | Not started |
| 6 | Replace ChildGrid with DataGrid + CrudPanel in SlidePanel | Not started |
| 7 | Design mode cleanup | Not started |
| 8 | Documentation and polish | Not started |

---

## Other Context Files

| File | Purpose |
|------|---------|
| 01-EntityDesigner.md | Entity Designer screen spec |
| 02-ScreenLayoutDesigner.md | Screen Layout Designer spec |
| 03-MetadataTables.md | Metadata table schemas |
| 04-InheritanceAndOverrides.md | Layout inheritance model |
| 05-CopyTemplateChangeOrder.md | Copy/template/change order workflows |
| 06-NotesAndAttachments.md | Notes and attachments system |
| 07-MenuIntegration.md | Menu integration spec |
| 08-BrowseAndSearch.md | Browse and search spec |
| 09-ApprovalWorkflow.md | Approval workflow spec |
| 10-EmailNotifications.md | Email notification spec |

These are background specs. The **active work** is the component architecture refactor.

---

## General Patterns

For general iSolutions coding patterns (API routes, UI components, DB conventions, i18n), load `ARCHITECTURE.md` via the `load_isolutions_docs` MCP tool. But for the current refactor context, THIS folder is the source of truth.
