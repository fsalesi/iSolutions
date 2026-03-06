"use client";
/**
 * FormPage — metadata-driven form renderer.
 * Reads form_layout to render: browse grid → detail tabs → sections → fields → child grids.
 * Uses SplitCrudPage with metadata-driven columns and FormDetailTabs as detail body.
 * Design mode state and all layout mutation handlers live in useDesignLayout.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { SplitCrudPage } from "../SplitCrudPage";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { ColumnDef } from "@/components/data-grid/DataGrid";
import type { FormMeta, Row } from "./types";
import { FieldPropertiesPanel } from "./panels/FieldPropertiesPanel";
import { SectionPropertiesPanel } from "./panels/SectionPropertiesPanel";
import { ToolbarActionPropertiesPanel } from "@/components/crud-toolbar/ToolbarActionPropertiesPanel";
import { useState as useStateFA } from "react";
import { TabPropertiesPanel } from "./panels/TabPropertiesPanel";
import { AddFieldPanel } from "./panels/AddFieldPanel";
import { FormDetailTabs } from "./FormDetailTabs";
import { useDesignLayout } from "./useDesignLayout";

export function FormPage({ formKey, apiPath, activeNav, onNavigate, selectRecordOid, selectSeq }: {
  formKey: string;
  apiPath: string;
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
  selectRecordOid?: string;
  selectSeq?: number;
}) {
  const [meta, setMeta] = useState<FormMeta | null>(null);
  const [error, setError] = useState("");

  const design = useDesignLayout([], meta?.headerTable ?? "");

  // Load all metadata on mount
  useEffect(() => {
    (async () => {
      try {
        // 1. Get form structure (tables)
        const structRes = await fetch(apiPath);
        const struct = await structRes.json();
        if (!struct.headerTable) { setError("Form has no header table"); return; }

        // 2. Get layout
        const layoutRes = await fetch(`/api/form_layout?filters=${encodeURIComponent(JSON.stringify({
          type: "group", logic: "and", children: [
            { type: "condition", field: "form_key", operator: "eq", value: formKey },
          ]
        }))}&limit=500`);
        const layoutData = await layoutRes.json();

        // 3. Get field metadata for colTypes
        const allTables = [struct.headerTable, ...struct.tables.filter((t: any) => t.table_name !== struct.headerTable).map((t: any) => t.table_name)];
        const fieldsRes = await fetch(`/api/form_fields?filters=${encodeURIComponent(JSON.stringify({
          type: "group", logic: "and", children: [
            { type: "condition", field: "form_key", operator: "eq", value: formKey },
            { type: "condition", field: "table_name", operator: "in_list", value: allTables.join(",") },
          ]
        }))}&limit=500`);
        const fieldsData = await fieldsRes.json();

        // Build colTypes from field metadata
        const colTypes: Record<string, string> = {
          oid: "text", domain: "text", created_at: "datetime", created_by: "text",
          updated_at: "datetime", updated_by: "text",
        };
        const colScales: Record<string, number> = {};
        for (const f of (fieldsData.rows || [])) {
          switch (f.data_type) {
            case "integer": colTypes[f.field_name] = "number"; colScales[f.field_name] = 0; break;
            case "numeric": colTypes[f.field_name] = "number"; colScales[f.field_name] = f.scale ?? 2; break;
            case "boolean": colTypes[f.field_name] = "boolean"; break;
            case "date": colTypes[f.field_name] = "date"; break;
            case "timestamptz": colTypes[f.field_name] = "datetime"; break;
            default: colTypes[f.field_name] = "text";
          }
        }

        // Layout lives in the design hook; everything else in meta
        design.setLayout(layoutData.rows || []);
        setMeta({
          tables: struct.tables,
          headerTable: struct.headerTable,
          layout: [], // kept for type compat; use design.layout for rendering
          colTypes,
          colScales,
          fields: (fieldsData.rows || []).map((f: any) => ({
            field_name: f.field_name, data_type: f.data_type, table_name: f.table_name, is_nullable: f.is_nullable,
          })),
        });
      } catch (e: any) { setError(e.message); }
    })();
  }, [formKey, apiPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive requiredFields from form_fields (NOT NULL, non-boolean)
  // overridden by form_layout properties.mandatory (true=force required, false=suppress)
  const requiredFields = useMemo<string[]>(() => {
    if (!meta) return [];
    const mandatoryMap = new Map<string, boolean>();
    for (const l of design.layout) {
      if (l.layout_type === "field" && l.table_name === meta.headerTable && l.properties?.mandatory != null) {
        mandatoryMap.set(l.layout_key, l.properties.mandatory as boolean);
      }
    }
    const result: string[] = [];
    for (const f of meta.fields) {
      if (f.table_name !== meta.headerTable) continue;
      const override = mandatoryMap.get(f.field_name);
      if (override === true) { result.push(f.field_name); continue; }
      if (override === false) continue;
      if (!f.is_nullable && f.data_type !== "boolean") result.push(f.field_name);
    }
    for (const [key, val] of mandatoryMap) {
      if (val && !result.includes(key)) result.push(key);
    }
    return result;
  }, [meta, design.layout]);

  // Derive grid columns from layout
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    if (!meta) return [];
    return design.layout
      .filter(l => l.layout_type === "grid_column" && l.table_name === meta.headerTable)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(gc => ({ key: gc.layout_key, label: gc.properties?.label }));
  }, [meta, design.layout]);

  // Derive header tabs from layout
  const headerTabs = useMemo(() =>
    meta ? design.layout.filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable).sort((a, b) => a.sort_order - b.sort_order) : [],
    [meta, design.layout],
  );

  // Bootstrap a default tab + section if none exist when entering design mode
  const handleDesignToggle = useCallback(async () => {
    const isEntering = !design.designMode;
    if (isEntering && meta) {
      const hasTabs = design.layout.some(
        l => l.layout_type === "tab" && l.table_name === meta.headerTable
      );
      if (!hasTabs) {
        try {
          // Create default tab
          const tabRes = await fetch("/api/form_layout?table=form_layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain: "*", form_key: formKey,
              table_name: meta.headerTable, layout_type: "tab",
              layout_key: "general", parent_key: "", sort_order: 10,
              properties: { label: "General" },
            }),
          });
          const tab = tabRes.ok ? await tabRes.json() : null;

          // Create default section inside that tab
          const secRes = await fetch("/api/form_layout?table=form_layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain: "*", form_key: formKey,
              table_name: meta.headerTable, layout_type: "section",
              layout_key: "general_details", parent_key: "general", sort_order: 10,
              properties: { label: "Details", columns: 2 },
            }),
          });
          const sec = secRes.ok ? await secRes.json() : null;

          if (tab) design.setLayout(prev => [...prev, tab, ...(sec ? [sec] : [])]);
        } catch { /* proceed anyway */ }
      }
    }
    design.toggleDesignMode();
  }, [design, meta, formKey]);

  const renderBody = useCallback((props: CrudPanelBodyProps) => {
    if (!meta) return null;
    return (
      <FormDetailTabs
        apiPath={apiPath}
        meta={{ ...meta, layout: design.layout }}
        headerTabs={headerTabs}
        row={props.row as Row}
        isNew={props.isNew}
        onChange={props.onChange as any}
        designMode={design.designMode}
        onFieldClick={design.designMode ? design.setSelectedField : undefined}
        onSectionClick={design.designMode ? design.setSelectedSection : undefined}
        onSectionAdded={design.designMode ? design.handleSectionAdded : undefined}
        onTabClick={design.designMode ? design.setSelectedTab : undefined}
        onTabAdded={design.designMode ? design.handleTabAdded : undefined}
        onFieldMoved={design.handleFieldMoved}
        onElementDropped={design.designMode ? design.handleElementDropped : undefined}
        onDesignToggle={handleDesignToggle}
        formKey={formKey}
        onLayoutUpdated={design.setLayout}
      />
    );
  }, [meta, apiPath, headerTabs, design, formKey, handleDesignToggle]);

  const [selectedToolbarAction, setSelectedToolbarAction] = useStateFA<import("@/components/crud-toolbar/useToolbarActions").DesignAction | null>(null);
  const [toolbarAddMode, setToolbarAddMode] = useStateFA(false);

  if (error) return <div style={{ padding: 24, color: "var(--danger-text)" }}>Error: {error}</div>;
  if (!meta) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading form...</div>;

  // Derived helpers for slide-in panels
  const headerSections = design.layout
    .filter(l => l.layout_type === "section" && l.table_name === meta.headerTable)
    .map(s => ({ key: s.layout_key, label: s.properties?.label || s.layout_key }));

  const headerTabList = design.layout
    .filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable)
    .map(t => ({ key: t.layout_key, label: t.properties?.label || t.layout_key }));

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
        onDesignToggle={design.toggleDesignMode}
        formKey={formKey}
        onButtonDesignClick={design.designMode ? setSelectedToolbarAction : undefined}
        onAddButton={design.designMode ? () => setToolbarAddMode(true) : undefined}
        activeNav={activeNav}
        onNavigate={onNavigate}
        gridId={`${formKey}:${meta.headerTable}`}
        selectRecordOid={selectRecordOid}
        selectSeq={selectSeq}
      />

      <FieldPropertiesPanel
        entry={design.selectedField}
        open={!!design.selectedField}
        onClose={() => design.setSelectedField(null)}
        onSaved={design.handleFieldSaved}
        sections={headerSections}
        sectionColumns={design.selectedField ? (design.layout.find(l => l.layout_type === "section" && l.layout_key === design.selectedField!.parent_key)?.properties?.columns || 2) : 2}
      />

      <AddFieldPanel
        open={!!design.designMode}
        onClose={() => {}}
        onAdded={design.handleFieldAdded}
        layout={design.layout}
        fields={meta.fields}
        formKey={formKey}
        tableName={meta.headerTable}
        tables={meta.tables}
        sections={headerSections}
      />

      <TabPropertiesPanel
        entry={design.selectedTab}
        open={!!design.selectedTab}
        onClose={() => design.setSelectedTab(null)}
        onSaved={design.handleTabSaved}
        onDeleted={design.handleTabDeleted}
        tabCount={design.layout.filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable).length}
      />

      <SectionPropertiesPanel
        entry={design.selectedSection}
        open={!!design.selectedSection}
        onClose={() => design.setSelectedSection(null)}
        onSaved={design.handleSectionSaved}
        onDeleted={design.handleSectionDeleted}
        tabs={headerTabList}
      />

      <ToolbarActionPropertiesPanel
        action={selectedToolbarAction}
        open={!!selectedToolbarAction || toolbarAddMode}
        formKey={formKey}
        tableName={meta.headerTable}
        addMode={toolbarAddMode}
        onClose={() => { setSelectedToolbarAction(null); setToolbarAddMode(false); }}
        onSaved={() => { setSelectedToolbarAction(null); setToolbarAddMode(false); }}
        onDeleted={() => { setSelectedToolbarAction(null); }}
      />
    </>
  );
}

export default FormPage;
