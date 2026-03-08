"use client";
/**
 * InlineCrud — self-contained inline CRUD unit.
 * Composes DataGrid + SlidePanel + CrudPanel + useLink.
 * Uses FormBodyCanvas for shared tab/content rendering.
 * MAINTAINER NOTE: Keep this file lean (composition + inline CRUD wiring only).
 * Do NOT add shared form design/layout logic here; put shared behavior in FormBody.tsx.
 */
import { useRef, useMemo } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { DataGrid, type DataPublisher, type ColumnDef } from "@/components/data-grid/DataGrid";
import type { ExportConfig } from "@/components/data-grid/datagrid/ExportPanel";
import { CrudPanel, type CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import { type CrudPanelRef } from "@/components/panels/CrudPanelContext";
import { useLink } from "@/hooks/useLink";
import { humanize } from "@/components/pages/FormPage/utils";
import { useSession } from "@/context/SessionContext";
import type { Row } from "@/components/pages/FormPage/types";
import { FormBody, FormBodyCanvas, useFormBodyController, buildFormDesignBindings } from "@/components/pages/FormPage/FormBody";

export interface InlineCrudProps {
  apiPath: string;
  table: string;
  columns: ColumnDef<Row>[];
  parentFilter?: Record<string, string | number>;
  saveExtras?: Record<string, string | number>;
  renderBody?: (props: CrudPanelBodyProps) => React.ReactNode;
  label?: string;
  formKey?: string;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  inquiryOnly?: boolean;
  allowAdd?: boolean;
}

export function InlineCrud({ apiPath, table, columns, parentFilter, saveExtras, renderBody, label, formKey, buttonHandlers, inquiryOnly = false, allowAdd = true }: InlineCrudProps) {
  const gridRef = useRef<DataPublisher>(null);
  const panelRef = useRef<CrudPanelRef>(null);
  const link = useLink(gridRef, panelRef);

  const { user } = useSession();

  const {
    loading,
    effectiveFields,
    design,
    handleDesignToggle,
  } = useFormBodyController({
    tableName: table,
    formKey,
    columns,
    defaultTabKey: table,
    defaultTabLabel: label || humanize(table),
  });

  const panelOpen = !inquiryOnly && !!(link.selectedRow || link.isNew);

  const designToggle = user?.isAdmin ? handleDesignToggle : undefined;
  const designBindings = useMemo(
    () => buildFormDesignBindings(design, designToggle),
    [design, designToggle]
  );

  const layoutRenderBody = (props: CrudPanelBodyProps) => {
    if (!formKey || loading) return null;
    return (
      <FormBodyCanvas
        apiPath={apiPath}
        tableName={table}
        layout={design.layout}
        row={props.row as Row}
        rowVersion={props.rowVersion}
        onChange={props.onChange}
        {...designBindings}
        formKey={formKey}
        buttonHandlers={buttonHandlers}
        fallbackTabKey={table}
      />
    );
  };

  return (
    <div>
      {label && (
        <div className="text-xs font-medium" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
          {label}
        </div>
      )}

      <DataGrid
        apiPath={apiPath}
        columns={columns}
        parentFilter={parentFilter}
        selectedId={link.selectedId}
        onSelect={link.onSelect}
        onNew={allowAdd ? link.onNew : undefined}
        pageSize={50}
        gridId={formKey ? `${formKey}:${table}` : table}
        exportConfig={{ table, searchFields: [], filename: `${table}-export` } as ExportConfig}
        ref={gridRef}
      />

      <SlidePanel
        open={panelOpen}
        onClose={link.onDeleted}
        title={link.isNew ? "New Record" : "Edit Record"}
        storageKey={formKey ? `${formKey}:${table}` : undefined}
      >
        {panelOpen && (
          <CrudPanel
            ref={panelRef}
            row={link.selectedRow}
            isNew={link.isNew}
            apiPath={apiPath}
            tableName={table}
            renderBody={renderBody || layoutRenderBody}
            onSaved={link.onSaved}
            onDeleted={link.onDeleted}
            onNew={link.onNew}
            savePayloadExtras={saveExtras}
            designMode={design.designMode}
            onDesignToggle={designToggle}
            formKey={formKey}
            buttonHandlers={buttonHandlers}
            style={{ height: "100%" }}
          />
        )}
      </SlidePanel>

      <FormBody
        design={design}
        tableName={table}
        formKey={formKey || ""}
        fields={effectiveFields}
      />
    </div>
  );
}
