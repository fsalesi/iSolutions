/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";
/**
 * FormDetailTabs — thin wrapper around FormBodyCanvas for header-table forms.
 */
import { useT } from "@/context/TranslationContext";
import type { LayoutEntry, Row, FormMeta } from "./types";
import { FormBodyCanvas } from "./FormBody";
import type { ButtonHandlerContext } from "@/components/crud-toolbar/types";

export function FormDetailTabs({
  apiPath,
  meta,
  row,
  onChange,
  keyFields,
  designMode,
  onFieldClick,
  onSectionClick,
  onSectionAdded,
  onTabClick,
  onTabAdded,
  onFieldMoved,
  onElementDropped,
  onDesignToggle,
  formKey,
  buttonHandlers,
}: {
  apiPath: string;
  meta: FormMeta;
  designMode?: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onTabClick?: (entry: LayoutEntry) => void;
  onTabAdded?: (entry: LayoutEntry) => void;
  onFieldMoved?: (oid: string, targetSection: string, targetRow: number, targetCol: number) => void;
  onElementDropped?: (data: unknown, targetSection: string, targetRow: number, targetCol: number) => void;
  onDesignToggle?: () => void;
  formKey?: string;
  buttonHandlers?: Record<string, (ctx: ButtonHandlerContext) => void | Promise<void>>;
  row: Row;
  onChange: (field: string, value: unknown) => void;
  keyFields?: string[];
}) {
  const t = useT();

  const fallbackTabKey =
    meta.layout
      .filter((l) => l.layout_type === "tab" && l.table_name === meta.headerTable)
      .sort((a, b) => a.sort_order - b.sort_order)[0]?.layout_key || "general";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <FormBodyCanvas
          apiPath={apiPath}
          tableName={meta.headerTable}
          layout={meta.layout}
          row={row}
          onChange={onChange}
          keyFields={keyFields}
          designMode={designMode}
          onFieldClick={onFieldClick}
          onSectionClick={onSectionClick}
          onSectionAdded={onSectionAdded}
          onTabClick={onTabClick}
          onTabAdded={onTabAdded}
          onFieldMoved={onFieldMoved}
          onElementDropped={onElementDropped}
          onDesignToggle={onDesignToggle}
          formKey={formKey}
          buttonHandlers={buttonHandlers}
          fallbackTabKey={fallbackTabKey}
          getTabLabel={(tab) => t(`form.${formKey}.${tab.layout_key}`, tab.properties?.label || tab.layout_key)}
        />
      </div>
    </div>
  );
}
