# 4. Inheritance & Overrides

> **ACTION ITEM: Delete the current hook system** (`src/lib/hooks/`, `customer/hooks/`, hook registration/discovery code). Replace with class inheritance. This is the first step in the Form Platform build.

## Current System (TO BE REMOVED)

The current system uses separate hook files discovered by convention:
- `src/lib/hooks/<table>.ts` — product hooks
- `customer/hooks/<table>.ts` — customer hooks
- `CrudHooks` interface with `beforeSave`, `afterSave`, `beforeDelete`
- Hook runner that loads and chains these files

**Problems:**
- Separate files for BL that belongs with the route
- Registration/discovery overhead
- Customer can't call super on product hooks cleanly
- No way to override internal building blocks (query construction, column selection, etc.)

## New System: Class Inheritance

### Class Hierarchy

Page and Route each have a three-level class hierarchy. Approval behavior is a class, not a conditional branch.

**Page:**
```
Page                          <- current base (hand-coded pages: Users, Locales, Settings)
  FormPage                    <- metadata-driven forms (tabs, sections, fields, child grids)
    ApprovalFormPage          <- adds status strip, approval history tab, submit/CO logic
```

**Route:**
```
CrudRoute                     <- base CRUD engine
  ApprovalCrudRoute           <- adds status lifecycle, submit validation, approval hooks
```

The Entity Designer's approvals flag determines which base class the generated files extend:
- Approvals OFF -> extends FormPage / CrudRoute
- Approvals ON -> extends ApprovalFormPage / ApprovalCrudRoute

This replaces iPurchase's mst.js pattern of 52 scattered `if (sApproval > "")` checks with clean inheritance.

### Route Layer

`CrudRoute` is the base engine. Generated routes extend it. Customer routes extend the generated routes.

```
CrudRoute (engine — ISS platform team)
  GET(request):
    columns = getColumns()              ← overridable
    filters = getFilters(request)       ← overridable
    sort = getSort(request)             ← overridable
    query = buildQuery(columns, filters, sort)  ← overridable
    return execute(query)
  POST(request):
    validate, insert, return
  PUT(request):
    validate, update, return
  DELETE(request):
    delete, return

SuppliersRoute extends CrudRoute (ISS product team — generated once)
  table = "suppliers"
  
  POST(request):
    validate tax ID format            ← before super
    result = super.POST(request)      ← standard save
    push supplier to QAD              ← after super
    return result

CustomerSuppliersRoute extends SuppliersRoute (customer)
  POST(request):
    my custom validation              ← before super
    result = super.POST(request)      ← runs ISS logic + standard save
    my custom side effects            ← after super
    return result
  
  getColumns():
    columns = super.getColumns()      ← standard from metadata
    columns.add("computed_total")     ← my extra stuff
    return columns
```

### Page Layer

`FormPage` is the base engine. Generated pages extend it. Customer pages extend the generated pages.

```
FormPage (engine — ISS platform team)
  render():
    layout = getLayout()              ← overridable
    tabs = getTabs()                  ← overridable
    sections = getSections(tab)       ← overridable
    fields = getFields(section)       ← overridable
    childGrids = getChildGrids()      ← overridable
    renderForm(layout, tabs, sections, fields, childGrids)

SuppliersPage extends FormPage (ISS product team — generated once)
  formKey = "suppliers"
  
  getTabs():
    tabs = super.getTabs()
    tabs.add("Compliance Dashboard")
    return tabs

CustomerSuppliersPage extends SuppliersPage (customer)
  getFields(section):
    fields = super.getFields(section)
    fields.find("tax_id").renderer = myCustomRenderer
    return fields
```

## File Structure

Customer files live outside `src/` so product upgrades never touch them.

```
src/lib/CrudRoute.ts                           ← engine (ISS platform)
src/components/FormPage.tsx                     ← engine (ISS platform)

src/app/forms/<form>/
  route.ts              ← API: ISS product (extends CrudRoute)
  page.tsx              ← UI: ISS product (extends FormPage)

customer/forms/<form>/
  route.ts              ← API: customer (extends src version) — API entry point
  page.tsx              ← UI: customer (extends src version) — menu entry point
```

## Ownership

| Layer | Owner | Upgradeable? | Files |
|---|---|---|---|
| Engine | ISS platform team | Yes — shared base classes | `CrudRoute.ts`, `FormPage.tsx` |
| Product forms | ISS product team | Generated once, then ISS edits | `page.tsx`, `route.ts` |
| Customer overrides | Customer / ISS-per-customer | Never touched by upgrades | `page.customer.tsx`, `route.customer.ts` |

## Resolution

The platform loader checks for the most specific version:

```
Route:  customer exists? → use it. Otherwise → ISS version.
Page:   customer exists? → use it. Otherwise → ISS version.
Neither exists? → CrudRoute / FormPage runs from metadata alone.
```

## Rules

- Engine classes (`CrudRoute`, `FormPage`) are always safe to upgrade
- Generated form files are created once by the Entity Designer, never regenerated
- Customer files are never touched by product upgrades or the generator
- `super` is the universal pattern — call it to get parent behavior, skip it to replace
- All internal building blocks (getColumns, getFilters, getTabs, getSections, etc.) are individually overridable
- Metadata (field_config, screen_layout) drives default behavior — code overrides are only needed for logic that can't be expressed as configuration
