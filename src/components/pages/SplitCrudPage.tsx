"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/shell";
import { SplitPanel } from "@/components/panels";
import { DataGrid, type ColumnDef } from "@/components/data-grid/DataGrid";
import { CrudPanel, type CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import type { CrudAction } from "@/components/crud-toolbar/CrudToolbar";
import { useCrudLink } from "@/hooks/useCrudLink";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useSession } from "@/context/SessionContext";

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
}: SplitCrudPageProps) {
  const api = apiPath || `/api/${table}`;
  const isMobile = useIsMobile();
  const { user } = useSession();
  const crud = useCrudLink({ apiPath: api, table, onNavigate, selectRecordOid, selectSeq });

  return (
    <AppShell title={title} showBack={isMobile && crud.showDetail} onBack={crud.handleBack} activeNav={activeNav} onNavigate={crud.guardedNavigate}>
      {isMobile ? (
        crud.showDetail ? (
          <CrudPanel ref={crud.crudRef} row={crud.link.selectedRow} isNew={crud.link.isNew}
            apiPath={api} tableName={table} defaultValues={defaultValues} renderBody={renderBody}
            extraActions={extraActions} designMode={designMode} onDesignToggle={onDesignToggle}
            onSaved={crud.link.onSaved} onDeleted={crud.onDeletedMobile} onNew={crud.link.onNew} />
        ) : (
          <DataGrid ref={crud.gridRef} table={table} apiPath={api} columns={columns}
            onSelect={crud.link.onSelect} selectedId={crud.link.selectedId}
            gridId={table} userId={user.userId} />
        )
      ) : (
        <SplitPanel storageKey={table} expanded={crud.showDetail}
          left={
            <DataGrid ref={crud.gridRef} table={table} apiPath={api} columns={columns}
              onSelect={crud.link.onSelect} selectedId={crud.link.selectedId}
              expanded={!crud.showDetail} onToggleExpand={() => crud.setShowDetail(d => !d)}
              gridId={table} userId={user.userId} />
          }
          right={
            <CrudPanel ref={crud.crudRef} row={crud.link.selectedRow} isNew={crud.link.isNew}
              apiPath={api} tableName={table} defaultValues={defaultValues} renderBody={renderBody}
              extraActions={extraActions} designMode={designMode} onDesignToggle={onDesignToggle}
              onSaved={crud.link.onSaved} onDeleted={crud.link.onDeleted} onNew={crud.link.onNew} />
          }
        />
      )}
    </AppShell>
  );
}
