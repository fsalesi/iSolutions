/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
/**
 * FormPage — metadata-driven form renderer.
 * Reads form_layout to render: browse grid -> detail tabs -> sections -> fields -> child grids.
 * Uses SplitCrudPage with metadata-driven columns and FormDetailTabs as detail body.
 * MAINTAINER NOTE: Keep this file lean (composition + page-specific wiring only).
 * Do NOT add shared form design/layout logic here; put shared behavior in FormBody.tsx.
 */
import { useMemo, useCallback } from "react";
import { SplitCrudPage } from "../SplitCrudPage";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import type { Row } from "./types";
import { FormDetailTabs } from "./FormDetailTabs";
import {
  FormBody,
  getFormStatus,
  useFormBodyController,
  buildRequiredFields,
  buildGridColumns,
  buildFormDesignBindings,
  buildFormMeta,
  useFormStructure,
} from "./FormBody";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";
import type { LookupHandlers } from "./types";

export function FormPage({ formKey, apiPath, activeNav, onNavigate, selectRecordOid, selectSeq, buttonHandlers, lookupHandlers }: {
  formKey: string;
  apiPath: string;
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  lookupHandlers?: LookupHandlers;
}) {
  const { structure, loading: structureLoading, error: structureError } = useFormStructure(apiPath);

  const tableNames = useMemo(
    () => (structure
      ? [
          structure.headerTable,
          ...structure.tables
            .filter((t) => t.table_name !== structure.headerTable)
            .map((t) => t.table_name),
        ]
      : []),
    [structure]
  );

  const headerTable = structure?.headerTable || "";

  const {
    effectiveFields,
    loading: metadataLoading,
    error: metadataError,
    design,
    handleDesignToggle,
  } = useFormBodyController({
    formKey,
    tableName: headerTable,
    tableNames,
    defaultTabKey: "general",
    defaultTabLabel: "General",
  });

  const meta = useMemo(() => buildFormMeta(structure, effectiveFields), [structure, effectiveFields]);
  const error = structureError || metadataError;

  const requiredFields = useMemo<string[]>(() => {
    if (!meta) return [];
    return buildRequiredFields(design.layout, meta.fields, meta.headerTable);
  }, [meta, design.layout]);

  const columns = useMemo(() => {
    if (!meta) return [];
    return buildGridColumns(design.layout, meta.headerTable);
  }, [meta, design.layout]);

  const designBindings = buildFormDesignBindings(design, handleDesignToggle);

  const renderBody = useCallback((props: CrudPanelBodyProps) => {
    if (!meta) return null;
    return (
      <FormDetailTabs
        apiPath={apiPath}
        meta={{ ...meta, layout: design.layout }}
        row={props.row as Row}
        rowVersion={props.rowVersion}
        onChange={props.onChange}
        lookupHandlers={lookupHandlers}
        keyFields={props.keyFields}
        {...designBindings}
        formKey={formKey}
        buttonHandlers={buttonHandlers}
      />
    );
  }, [meta, apiPath, design.layout, designBindings, formKey, buttonHandlers, lookupHandlers]);

  const isLoading = !meta || metadataLoading || structureLoading;
  const status = getFormStatus(error, isLoading);
  if (status) return <div style={{ padding: 24, color: status.color }}>{status.text}</div>;
  if (!meta) return null;

  return (
    <>
      <SplitCrudPage
        title={design.designMode ? `${formKey} — Design Mode` : formKey}
        table={meta.headerTable}
        apiPath={`${apiPath}?table=${meta.headerTable}`}
        columns={columns}
        requiredFields={requiredFields}
        renderBody={renderBody}
        designMode={design.designMode}
        onDesignToggle={handleDesignToggle}
        formKey={formKey}
        buttonHandlers={buttonHandlers}
        activeNav={activeNav}
        onNavigate={onNavigate}
        gridId={`${formKey}:${meta.headerTable}`}
        selectRecordOid={selectRecordOid}
        selectSeq={selectSeq}
      />

      <FormBody
        design={design}
        tableName={meta.headerTable}
        formKey={formKey}
        fields={meta.fields}
        tables={meta.tables}
      />
    </>
  );
}

export default FormPage;
