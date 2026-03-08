# iSolutions Form Platform

> A configurable, metadata-driven form engine that enables visual design of business entities, screen layouts, field behavior, and custom logic — replacing the iPurchase `newmaintv2.p` / `getsettings.p` / `ATTRS_` stack with a modern, database-backed platform.

## Architecture

**A form is a composite entity** — one header table plus zero or more child tables, all managed together. Example: Supplier Onboarding = Supplier (header) + Addresses + Contacts + Bank Accounts + Certifications.

**Two design tools:**
- **Entity Designer** — schema: create forms, tables, fields, relationships. Generates PostgreSQL tables and starter code.
- **Screen Layout Designer** — UI: live design mode on running forms. Place fields, configure renderers, create tabs and sections. Per-domain.

**Two runtime engines:**
- **FormPage** — React component that reads layout metadata and renders the form. Tabs, sections, fields, child grids — all metadata-driven.
- **CrudRoute** — API route that reads schema metadata and handles CRUD. Every building block overridable via inheritance.

**Ownership model:** Engine (platform) → Product (ISS-generated) → Customer (never touched by upgrades). Three files per form, clean inheritance chain.

---

## Phase 1 — Form Platform Core

| # | Document | Description |
|---|---|---|
| 1 | [Entity Designer](FormPlatformDetails/01-EntityDesigner.md) | Form creation, table design, standard fields, relationships, schema generation, generated artifacts |
| 2 | [Screen Layout Designer](FormPlatformDetails/02-ScreenLayoutDesigner.md) | Design mode, tabs, sections, field placement, field properties, renderers, domain scoping |
| 3 | [Metadata Tables](FormPlatformDetails/03-MetadataTables.md) | 6 tables that power everything: forms, form_tables, form_fields, form_layout, platform_attachment_types, platform_attachments |
| 4 | [Inheritance & Overrides](FormPlatformDetails/04-InheritanceAndOverrides.md) | Class hierarchy, route/page layers, file structure, three-tier ownership, override pattern |
| 5 | [Copy, Templates & Change Orders](FormPlatformDetails/05-CopyTemplateChangeOrder.md) | Copy mechanism, non-copyable fields, child record cloning, templates, change orders |
| 6 | [Notes & Attachments](FormPlatformDetails/06-NotesAndAttachments.md) | Platform notes (already built), attachment fields (named docs), attachment tabs (collections), rollup behavior, security |
| 7 | [Menu Integration](FormPlatformDetails/07-MenuIntegration.md) | Auto-generated menu entries, admin picks category at design time, always routes to customer page |
| 8 | [Browse & Search](FormPlatformDetails/08-BrowseAndSearch.md) | No separate search system — searchable flag per field drives browse grid filters via PostgreSQL |

## Phase 2 — Approval Layer

| # | Document | Description |
|---|---|---|
| 9 | [Approval Workflow](FormPlatformDetails/09-ApprovalWorkflow.md) | Status lifecycle, field locking, button visibility, approval routing, audit trail, change order approvals |
| 10 | [Email Notifications](FormPlatformDetails/10-EmailNotifications.md) | Event-driven emails with templates, field substitution, dynamic recipients |

---

## Key Design Decisions

**Domain security at engine level.** Domain is never visible or editable on any form. CrudRoute sets it from session on POST, filters by session domain on GET/PUT/DELETE. Cross-domain access is impossible.

**Metadata drives defaults, code drives exceptions.** Everything configurable through the designers. Override via inheritance only when logic can't be expressed as configuration.

**One form_layout table with JSONB.** Tabs, sections, fields, and grid columns all in one table. `layout_type` + `parent_key` builds the tree. `properties` JSONB holds type-specific attributes. Domain override resolution via `DISTINCT ON`.

**Standard fields are automatic.** Every table gets oid (UUID PK), domain, created_at, created_by, updated_at, updated_by, custom_fields (JSONB), copied_from. Not in metadata — engine adds them.

**Relationships by convention.** Child tables linked via `oid_<parent_table>` FK column. Platform discovers relationships by scanning for `oid_*` columns.

**Children as tabs, editing via slide-in.** All child tables render as tabs with grids. Clicking a row opens a slide-in panel from the right. Panels stack (LIFO), dirty-check on close.

**Attachment fields + attachment tabs.** Named document fields (W9, quote) are `attachment` type fields on the form. Generic collections (internal/external docs) are attachment tabs with configurable types and security. One storage table for both. Header tab rolls up all children.

**Notes are platform-wide.** Already built at the Page level. Collaborative comments, @mentions, notifications. Not business data — those are fields on the form.

**Approvals snap on via inheritance.** FormPage → ApprovalFormPage. CrudRoute → ApprovalCrudRoute. Clean separation. Toggling approvals after generation modifies the `extends` line — with warnings and customer file protection.

**Files never regenerated.** First Generate creates everything. Subsequent generates only ALTER TABLE. The one exception: toggling approvals changes the base class (with safeguards).


## Potential Problems that need further discussion
** What if I want to add another field to the screen which is not a schema field.
** Lookups need a way to have onSelected auto populate other fields (based on the return json we should know which fields are available and can map a UI field to a json field)
