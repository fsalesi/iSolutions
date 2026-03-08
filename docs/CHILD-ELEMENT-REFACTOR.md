# ChildElement Refactor - Unified show()/hide()/destroy() API

**Status:** COMPLETE ✅  
**Date:** 2026-03-08  
**Purpose:** Replace render()/Renderable with unified ChildElement interface

---

## Problem

1. TabRenderer filters children by `type === "section"` - ignores grids
2. Two separate interfaces for rendering: `Renderable.render()` and `ChildElement.display()`
3. Type-checking in renderers defeats polymorphism
4. Child grids (like RequisitionLinesGrid) don't appear in tabs

## Solution

Single interface for all displayable elements with complete lifecycle:

| Method | Purpose | Returns |
|--------|---------|---------|
| `show()` | Render yourself as React | `ReactNode` |
| `display(row)` | Receive data from parent (cascade) | `void` |
| `hide()` | Temporarily hidden (stub) | `void` |
| `destroy()` | Cleanup/teardown (stub) | `void` |

---

## Checklist

### Step 1: Update ChildElement Interface
- [x] `src/platform/core/ChildElement.ts` - Add `show(): ReactNode`
- [x] `src/platform/core/ChildElement.ts` - Add `hide(): void`
- [x] `src/platform/core/ChildElement.ts` - Add `destroy(): void`

### Step 2: Implement show() on Each Class
- [x] `src/platform/core/FieldDef.ts` - `show()` returns `<FieldRenderer field={this} />`
- [x] `src/platform/core/SectionDef.ts` - `show()` returns `<SectionRenderer section={this} />`
- [x] `src/platform/core/TabDef.ts` - `show()` stub (tabs rendered by parent)
- [x] `src/platform/core/DataGridDef.tsx` - `show()` returns `<DataGridRenderer grid={this} />`
- [x] `src/platform/core/EditPanel.tsx` - `show()` with current render logic
- [x] Page defs - `show()` replaces `render()`

### Step 3: Add hide() and destroy() Stubs
- [x] `FieldDef` - `hide() {}`, `destroy() {}`
- [x] `SectionDef` - `hide() {}`, `destroy() {}`
- [x] `TabDef` - `hide() {}`, `destroy() {}`
- [x] `DataGridDef` - `hide() {}`, `destroy() {}`
- [x] `EditPanel` - `hide() {}`, `destroy() {}`

### Step 4: Update TabRenderer
- [x] `src/components/panel/TabRenderer.tsx` - Remove `.filter(c => c.type === "section")`
- [x] `src/components/panel/TabRenderer.tsx` - Call `child.show()` for all children

### Step 5: Delete Renderable Interface
- [x] `src/platform/core/LayoutNode.ts` - Remove `Renderable` interface → `Showable`
- [x] `src/platform/core/LayoutNode.ts` - `LeafNode.render()` → `LeafNode.show()`
- [x] `src/components/layout/LayoutRenderer.tsx` - Call `show()` not `render()`

### Step 6: Remove All render() Methods
- [x] `DataGridDef.tsx` - Remove `render()`, use `show()` only
- [x] `EditPanel.tsx` - Remove `render()`, use `show()` only
- [x] Page defs - Remove `render()`, use `show()` only
- [x] `registry.ts` - PageInstance interface → `show()` not `render()`
- [x] `app/page.tsx` - Call `page.show()` not `page.render()`

### Step 7: Implement DataGridDef.display() for Child Grids
- [x] `src/platform/core/DataGridDef.tsx` - Implement `display(parentRow)`
- [x] Use `parentLink` config to build filter
- [x] Call `fetch()` with parent row's oid

### Step 8: Build & Test
- [x] Run `npm run build` - verify no TypeScript errors
- [ ] Test: RequisitionPage loads
- [ ] Test: Lines tab shows RequisitionLinesGrid
- [ ] Test: Selecting a requisition populates lines grid
- [ ] Test: Other pages still work (Users, Groups, etc.)

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `ChildElement.ts` | Add `show()`, `hide()`, `destroy()` to interface |
| `FieldDef.ts` | Implement `show()`, stub `hide()`/`destroy()` |
| `SectionDef.ts` | Implement `show()`, stub `hide()`/`destroy()` |
| `TabDef.ts` | Stub all three |
| `DataGridDef.tsx` | `show()` replaces `render()`, implement `display()` |
| `EditPanel.tsx` | `show()` replaces `render()` |
| `LayoutNode.ts` | `Renderable` → `Showable`, `render()` → `show()` |
| `LayoutRenderer.tsx` | Call `show()` |
| `TabRenderer.tsx` | Polymorphic child rendering via `child.show()` |
| `registry.ts` | PageInstance uses `show()` |
| `app/page.tsx` | Call `page.show()` |
| All page-def index.tsx | `implements Showable`, `show()` method |

---

## Notes

- Build passes ✅
- `hide()` and `destroy()` are stubs for now - implementations added as needed
- `display(row)` already exists - DataGridDef now properly uses `parentLink` to filter child grids
- Ready for Frank to test
