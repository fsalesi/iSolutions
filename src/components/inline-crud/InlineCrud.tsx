"use client";
/**
 * InlineCrud — self-contained inline CRUD unit.
 * Composes DataGrid + SlidePanel + CrudPanel + useLink.
 * Uses HeaderTabContent for panel body — identical code path as main panel.
 * Uses useDesignLayout for design mode — identical handlers as main panel.
 */
import { useRef, useState, useEffect, useMemo } from "react";
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
import { TabPropertiesPanel } from "@/components/pages/FormPage/panels/TabPropertiesPanel";
import { AddTabButton } from "@/components/pages/FormPage/AddTabButton";
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
  const [activeTabKey, setActiveTabKey] = useState<string>("");
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

  // Derive real tabs from layout; fall back to virtual tab (table name) for legacy layouts
  const layoutTabs = useMemo(() =>
    design.layout
      .filter(l => l.layout_type === "tab" && l.table_name === table)
      .sort((a, b) => a.sort_order - b.sort_order),
    [design.layout, table]
  );

  // Active tab key: prefer real tab, fall back to table name for legacy
  const effectiveTabKey = activeTabKey ||
    (layoutTabs.length > 0 ? layoutTabs[0].layout_key : table);

  // Sync activeTabKey when layout loads
  useEffect(() => {
    if (layoutTabs.length > 0 && !activeTabKey) {
      setActiveTabKey(layoutTabs[0].layout_key);
    }
  }, [layoutTabs.length]);

  // Bootstrap default tab + section when entering design mode with no tabs
  const handleDesignToggle = async () => {
    const isEntering = !designMode;
    if (isEntering && formKey) {
      const hasTabs = design.layout.some(
        l => l.layout_type === "tab" && l.table_name === table
      );
      if (!hasTabs) {
        try {
          const tabKey = table;
          const tabRes = await fetch("/api/form_layout?table=form_layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain: "*", form_key: formKey,
              table_name: table, layout_type: "tab",
              layout_key: tabKey, parent_key: "", sort_order: 10,
              properties: { label: label || humanize(table) },
            }),
          });
          const tab = tabRes.ok ? await tabRes.json() : null;

          // Re-parent any existing sections to this new tab
          const existingSections = design.layout.filter(
            l => l.layout_type === "section" && l.table_name === table
          );

          if (existingSections.length === 0) {
            const secRes = await fetch("/api/form_layout?table=form_layout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                _table: "form_layout", domain: "*", form_key: formKey,
                table_name: table, layout_type: "section",
                layout_key: `${table}_details`, parent_key: tabKey, sort_order: 10,
                properties: { label: "Details", columns: 2 },
              }),
            });
            const sec = secRes.ok ? await secRes.json() : null;
            if (tab) design.setLayout(prev => [...prev, tab, ...(sec ? [sec] : [])]);
          } else {
            if (tab) design.setLayout(prev => [...prev, tab]);
          }

          setActiveTabKey(tabKey);
        } catch { /* proceed anyway */ }
      }
    }
    setDesignMode(d => !d);
  };

  const panelOpen = !!(link.selectedRow || link.isNew);

  const tabList = layoutTabs.map(t => ({
    key: t.layout_key,
    label: t.properties?.label || humanize(t.layout_key),
  }));

  const layoutRenderBody = (props: CrudPanelBodyProps) => {
    if (!fetched) return null;
    return (
      <div>
        {/* Tab bar — always shown in design mode, shown when >1 tab otherwise */}
        {(tabList.length > 1 || designMode) && (
          <div className="flex overflow-x-auto px-2"
            style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
            {tabList.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTabKey(tab.key)}
                className="flex items-center px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  borderBottom: `2px solid ${effectiveTabKey === tab.key ? "var(--accent)" : "transparent"}`,
                  color: effectiveTabKey === tab.key ? "var(--accent)" : "var(--text-secondary)",
                }}
                onDoubleClick={designMode ? () => {
                  const entry = layoutTabs.find(t => t.layout_key === tab.key);
                  if (entry) design.setSelectedTab(entry);
                } : undefined}
              >
                {tab.label}
              </button>
            ))}
            {designMode && (
              <AddTabButton
                layout={design.layout}
                tableName={table}
                onAdded={entry => { design.handleTabAdded(entry); setActiveTabKey(entry.layout_key); }}
              />
            )}
          </div>
        )}

        <div style={{ padding: "8px 16px" }}>
          <HeaderTabContent
            apiPath={apiPath}
            tableName={table}
            tabKey={effectiveTabKey}
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
            onDesignToggle={handleDesignToggle}
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
          tabs={tabList}
        />
      )}

      {design.selectedTab && (
        <TabPropertiesPanel
          entry={design.selectedTab}
          open={!!design.selectedTab}
          onClose={() => design.setSelectedTab(null)}
          onSaved={design.handleTabSaved}
          onDeleted={design.handleTabDeleted}
          tabCount={layoutTabs.length}
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
