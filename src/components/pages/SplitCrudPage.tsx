"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/shell";
import { SplitPanel } from "@/components/panels";
import { DataGrid, type ColumnDef } from "@/components/data-grid/DataGrid";
import type { ExportConfig } from "@/components/data-grid/datagrid/ExportPanel";
import { CrudPanel, type CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import type { DesignAction } from "@/components/crud-toolbar/useToolbarActions";
import { useCrudLink } from "@/hooks/useCrudLink";
import { useIsMobile } from "@/hooks/useIsMobile";

export interface SplitCrudPageProps {
  title: string;
  table: string;
  apiPath?: string;
  columns: ColumnDef<any>[];
  defaultValues?: Record<string, any>;
  renderBody: (props: CrudPanelBodyProps) => React.ReactNode;
  extraActions?: CrudAction[];
  designMode?: boolean;
  onDesignToggle?: () => void;
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
  /** Override required fields entirely (e.g. FormPage derives them from metadata) */
  requiredFields?: string[];
  /** Additional required fields stacked on top of the base required list */
  extraRequiredFields?: string[];
  /** Form key passed to CrudPanel for toolbar action overrides */
  formKey?: string;
  onButtonDesignClick?: (action: DesignAction) => void;
  onAddButton?: () => void;
  /** Override the gridId used for column/export prefs. Defaults to table name. */
  gridId?: string;
  /** Columns used for search in export. Defaults to first 3. */
  searchColumns?: string[];
}

export function SplitCrudPage({
  title,
  table,
  apiPath,
  columns,
  defaultValues,
  renderBody,
  extraActions,
  designMode,
  onDesignToggle,
  activeNav,
  onNavigate,
  selectRecordOid,
  selectSeq,
  requiredFields: requiredFieldsProp,
  extraRequiredFields,
  gridId: gridIdProp,
  formKey,
  searchColumns,
  onButtonDesignClick,
  onAddButton,
}: SplitCrudPageProps) {
  const api = apiPath || `/api/${table}`;
  const effectiveGridId = gridIdProp || table;
  const exportCfg: ExportConfig = { table, searchFields: searchColumns || [], filename: `${table}-export` };
  const isMobile = useIsMobile();
  const crud = useCrudLink({ apiPath: api, table, onNavigate, selectRecordOid, selectSeq });
  // Use explicit prop if provided (FormPage), otherwise use API-fetched required fields
  const baseRequiredFields = requiredFieldsProp ?? crud.requiredFields;

  return (
    <AppShell title={title} showBack={isMobile && crud.showDetail} onBack={crud.handleBack} activeNav={activeNav} onNavigate={crud.guardedNavigate}>
      {isMobile ? (
        crud.showDetail ? (
          <CrudPanel ref={crud.crudRef} row={crud.link.selectedRow} isNew={crud.link.isNew}
            apiPath={api} tableName={table} defaultValues={defaultValues} renderBody={renderBody}
            requiredFields={baseRequiredFields} extraRequiredFields={extraRequiredFields}
            extraActions={extraActions} designMode={designMode} onDesignToggle={onDesignToggle} formKey={formKey} onButtonDesignClick={onButtonDesignClick} onAddButton={onAddButton}
            onSaved={crud.link.onSaved} onDeleted={crud.onDeletedMobile} onNew={crud.link.onNew} />
        ) : (
          <DataGrid ref={crud.gridRef} table={table} apiPath={api} columns={columns}
            onSelect={crud.link.onSelect} selectedId={crud.link.selectedId}
            gridId={effectiveGridId} exportConfig={exportCfg} />
        )
      ) : (
        <SplitPanel storageKey={table} expanded={crud.showDetail}
          left={
            <DataGrid ref={crud.gridRef} table={table} apiPath={api} columns={columns}
              onSelect={crud.link.onSelect} selectedId={crud.link.selectedId}
              expanded={!crud.showDetail} onToggleExpand={() => crud.setShowDetail(d => !d)}
              gridId={effectiveGridId} exportConfig={exportCfg} />
          }
          right={
            <CrudPanel ref={crud.crudRef} row={crud.link.selectedRow} isNew={crud.link.isNew}
              apiPath={api} tableName={table} defaultValues={defaultValues} renderBody={renderBody}
              requiredFields={baseRequiredFields} extraRequiredFields={extraRequiredFields}
              extraActions={extraActions} designMode={designMode} onDesignToggle={onDesignToggle} formKey={formKey} onButtonDesignClick={onButtonDesignClick} onAddButton={onAddButton}
              onSaved={crud.link.onSaved} onDeleted={crud.link.onDeleted} onNew={crud.link.onNew} />
          }
        />
      )}
    </AppShell>
  );
}
