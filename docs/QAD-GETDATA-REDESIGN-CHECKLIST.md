# QAD getData Redesign Checklist

Status: Active
Last updated: 2026-03-12

## Goal

Align iSolutions with the established `getData.p` contract:
- `config.xml` is the single source of truth for predefined datasets.
- iSolutions may send a table name or a predefined dataset name in `dsName`.
- iSolutions does not author ad hoc dataset definitions for normal usage.
- The lookup designer maps directly to `getData.p` inputs.

## Phases

### Phase 1: Lock the contract
- [x] Confirm iSolutions supports `dsName` as either table name or predefined `ibDataSet` name.
- [x] Confirm `config.xml` is the sole truth for predefined datasets.
- [x] Confirm ad hoc `configxml` authoring is removed from the normal iSolutions flow.
- [x] Confirm the minimal `getData` request shape iSolutions should send.

### Phase 1 decisions
- `config.xml` is the single source of truth for predefined datasets.
- `dsName` may reference either a table name or a predefined `ibDataSet` name from `config.xml`.
- iSolutions should not author ad hoc dataset definitions for normal usage.
- If a lookup or test needs more than a table, it should use a predefined dataset from `config.xml`.
- The iSolutions side should stay dumb: package the standard `getData.p` request inputs, not invent dataset structure.
- The lookup designer should map to the real `getData.p` inputs and allow selecting predefined datasets.

### Minimal getData request shape
```json
{
  "dsName": "so_mstr",
  "whereClause": "so_domain eq 'demo1' and so_nbr eq 'SO10420'",
  "fieldSet": "so_domain,so_nbr,so_cust,so_ord_date,so_stat,so_site",
  "numRecords": 1
}
```

Notes:
- `dsName` may also be a predefined dataset name from `config.xml`.
- Standard optional flags like `outputFormat`, `sort`, `dir`, and `restartRowid` may still be passed when needed.
- Normal iSolutions usage should not send `configxml`.

### Phase 2: Expose config metadata from OE
- [x] Add a safe read-only `GET` path in `ApiHandler.cls` for approved file access.
- [x] Support fetching `/apps/ipurchase/code/common/config.xml`.
- [x] Keep file access tightly scoped and read-only.

### Phase 3: Load config.xml in iSolutions
- [x] Add an iSolutions loader for config metadata.
- [x] Parse available `ibTable` names.
- [x] Parse available `ibDataSet` names.
- [x] Define the client shape used by the designer/runtime.

### Phase 4: Simplify QAD getData packaging
- [x] Remove dynamic dataset construction from the main iSolutions `getData` path.
- [x] Keep simple request packaging for `dsName`, `whereClause`, `fieldSet`, `numRecords`, and standard flags.
- [x] Preserve support for table-backed requests.
- [x] Preserve support for predefined dataset-backed requests.

### Phase 5: Update the test harness
- [x] Update examples to use table names or predefined dataset names.
- [x] Remove examples that imply ad hoc dataset XML authoring is the normal path.
- [x] Keep the harness aligned with the real `getData.p` contract.

### Phase 6: Remap the lookup designer
- [x] Allow choosing a source type of table or predefined dataset.
- [x] Map designer fields directly to `getData.p` inputs.
- [x] Allow choosing any predefined `ibDataSet` from `config.xml`.
- [x] Verify runtime lookups already using `getData.p` still fit the new mapping.

### Phase 7: Cleanup
- [x] Remove temporary debugging from `ApiHandler.cls`.
- [x] Remove stale iSolutions code paths that rebuild datasets dynamically.
- [ ] Re-test representative table and dataset lookups end to end.

## Progress Log
- 2026-03-12: Checklist created.
- 2026-03-12: Phase 1 locked. Agreed that `config.xml` is the sole dataset source, `dsName` may be a table or predefined dataset, and normal iSolutions usage should not author `configxml`.
- 2026-03-12: Phase 2 complete. `ApiHandler.cls` now supports read-only GET file fetches, and `GET /QAD/web/api?file=config.xml` returns the resolved file content.
- 2026-03-12: Phase 3 complete. Added an iSolutions config loader/service, parsed `ibTable` and `ibDataSet` metadata, and exposed it via `/api/qad/config` for authenticated callers. Runtime route testing still pending.
- 2026-03-12: Phase 4 complete. Simplified the main `getData` packaging path so it no longer rebuilds datasets or auto-generates XML. The proxy now sends the standard request fields and only passes `configxml` through when explicitly supplied.
- 2026-03-12: Phase 5 complete. Updated the test harness and presets so dataset examples use predefined `dsName` values from `config.xml` instead of demonstrating ad hoc dataset authoring.
- 2026-03-12: Phase 6 complete. Added a dedicated `QAD getData` lookup source to the designer, wired it to direct `getData.p` inputs, and loaded table/dataset choices from `/api/qad/config`. Runtime UI testing still pending.
- 2026-03-12: Phase 6 refined. `qad_getdata` now uses manual text inputs for source name, fields, column lists, and lookup flags instead of the generic chooser/default controls. `$DOMAIN` replacement also now supports raw `getData` templates while keeping the canned QAD presets working. `npm run build` passes.
- 2026-03-12: Phase 7 progressed. Removed the last stale dynamic-dataset request fields from the iSolutions `getData` path and removed the temporary `ApiHandler.cls` file-write debugging. End-to-end table/dataset re-test remains as the last cleanup check.
