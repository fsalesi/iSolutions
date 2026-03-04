"use client";
/**
 * InlineCrud — self-contained inline CRUD unit.
 * Composes DataGrid + SlidePanel + CrudPanel + useLink.
 * Uses HeaderTabContent for panel body — identical code path as main panel.
 * Uses useDesignLayout for design mode — identical handlers as main panel.
 */
import { useRef, useState, useEffect } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { DataGrid, type DataPublisher, type ColumnDef } from "@/components/data-grid/DataGrid";
import { CrudPanel, type CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { type CrudPanelRef } from "@/components/panels/CrudPanelContext";
import { useLink } from "@/hooks/useLink";
import { humanize } from "@/components/pages/FormPage/utils";
import type { LayoutEntry, FormField, Row } from "@/components/pages/FormPage/types";
import { HeaderTabContent } from "@/components/pages/FormPage/HeaderTabContent";
import { useDesignLayout } from "@/components/pages/FormPage/useDesignLayout";
import { FieldPropertiesPanel } from "@/components/pages/FormPage/panels/FieldPropertiesPanel";
import { SectionPropertiesPanel } from "@/components/pages/FormPage/panels/SectionPropertiesPanel";
import { AddFieldPanel } from "@/components/pages/FormPage/panels/AddFieldPanel";

export interface InlineCrudProps {
  apiPath: string;
  table: string;
  columns: ColumnDef<any>[];
  parentFilter?: Record<string, any>;
  saveExtras?: Record<string, any>;
  renderBody?: (props: CrudPanelBodyProps) => React.ReactNode;
  label?: string;
  formKey?: string;
}

export function InlineCrud({ apiPath, table, columns, parentFilter, saveExtras, renderBody, label, formKey }: InlineCrudProps) {
  const gridRef = useRef<DataPublisher>(null);
  const panelRef = useRef<CrudPanelRef>(null);
  const link = useLink(gridRef, panelRef);

  const [designMode, setDesignMode] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [fetched, setFetched] = useState(false);

  const design = useDesignLayout([], table);

  // Fetch layout + fields for this child table
  useEffect(() => {
    if (!formKey) return;
    (async () => {
      const [layoutRes, fieldsRes] = await Promise.all([
        fetch(`/api/form_layout?filters=${encodeURIComponent(JSON.stringify({
          type: "group", logic: "and", children: [
            { type: "condition", field: "form_key", operator: "eq", value: formKey },
            { type: "condition", field: "table_name", operator: "eq", value: table },
          ]
        }))}&limit=500`),
        fetch(`/api/form_fields?filters=${encodeURIComponent(JSON.stringify({
          type: "group", logic: "and", children: [
            { type: "condition", field: "form_key", operator: "eq", value: formKey },
            { type: "condition", field: "table_name", operator: "eq", value: table },
          ]
        }))}&limit=500`),
      ]);
      const layoutData = await layoutRes.json();
      const fieldsData = await fieldsRes.json();
      design.setLayout(layoutData.rows || []);
      const ff = (fieldsData.rows || []).map((f: any) => ({
        field_name: f.field_name, data_type: f.data_type, table_name: f.table_name,
      }));
      setFields(ff.length > 0 ? ff : columns.map(col => ({
        field_name: col.key, data_type: "text", table_name: table,
      })));
      setFetched(true);
    })();
  }, [formKey, table]);

  const panelOpen = !!(link.selectedRow || link.isNew);

  // The tabKey for the child is the table name itself
  // (sections have parent_key = table name)
  const tabKey = table;

  const layoutRenderBody = (props: CrudPanelBodyProps) => {
    if (!fetched) return null;
    return (
      <div style={{ padding: "8px 16px" }}>
      <HeaderTabContent
        apiPath={apiPath}
        tableName={table}
        tabKey={tabKey}
        layout={design.layout}
        row={props.row as Row}
        onChange={props.onChange as any}
        isNew={props.isNew}
        designMode={designMode}
        onFieldClick={designMode ? design.setSelectedField : undefined}
        onSectionClick={designMode ? design.setSelectedSection : undefined}
        onSectionAdded={designMode ? design.handleSectionAdded : undefined}
        onFieldReordered={design.handleFieldReordered}
        onElementDropped={designMode ? design.handleElementDropped : undefined}
        formKey={formKey}
      />
      </div>
    );
  };

  return (
    <div>
      {label && (
        <div className="text-xs font-medium" style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
          {label}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn btn-sm btn-primary" onClick={link.onNew}>+ Add</button>
      </div>

      <DataGrid
        apiPath={apiPath}
        columns={columns}
        parentFilter={parentFilter}
        selectedId={link.selectedId}
        onSelect={link.onSelect}
        pageSize={50}
        ref={gridRef}
      />

      <SlidePanel
        open={panelOpen}
        onClose={link.onDeleted}
        title={link.isNew ? "New Record" : "Edit Record"}
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
            designMode={designMode}
            onDesignToggle={() => setDesignMode(d => !d)}
            style={{ height: "100%" }}
          />
        )}
      </SlidePanel>

      {design.selectedField && (
        <FieldPropertiesPanel
          entry={design.selectedField}
          open={!!design.selectedField}
          onClose={() => design.setSelectedField(null)}
          onSaved={design.handleFieldSaved}
        />
      )}

      {design.selectedSection && (
        <SectionPropertiesPanel
          entry={design.selectedSection}
          open={!!design.selectedSection}
          onClose={() => design.setSelectedSection(null)}
          onSaved={design.handleSectionSaved}
          onDeleted={design.handleSectionDeleted}
          tabs={[{ key: table, label: label || humanize(table) }]}
        />
      )}

      <AddFieldPanel
        open={designMode}
        onClose={() => {}}
        layout={design.layout}
        fields={fields}
        tableName={table}
        formKey={formKey || ""}
        sections={design.layout
          .filter(l => l.layout_type === "section" && l.table_name === table)
          .map(l => ({ key: l.layout_key, label: l.properties?.label || l.layout_key }))}
      />
    </div>
  );
}
