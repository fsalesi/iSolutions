# 8. Browse & Search

> **NOT NEEDED** — PostgreSQL provides native search capabilities. CrudRoute's `getFilters()` already drives browse grid filtering.

## Replaced By

**Field-level searchable flag** in the Screen Layout Designer:

Each field has a `searchable` property (default: false). When enabled, that field appears as a filterable column in the browse grid. Users can filter/search on any field flagged as searchable.

This is just a field property — no separate search infrastructure, no search index tables, no external search engines. PostgreSQL handles the queries with ILIKE or full-text search as needed.

## Configuration

In the Screen Layout Designer, field properties:
```
Field: vendor_name
  searchable: ☑ (shows as filter column in browse grid)

Field: internal_notes
  searchable: ☐ (not filterable)
```

CrudRoute's `getFilters()` reads metadata to determine which fields are searchable and builds the appropriate WHERE clauses.
