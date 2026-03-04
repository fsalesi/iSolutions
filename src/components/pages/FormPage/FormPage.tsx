"use client";
/**
 * FormPage — metadata-driven form renderer.
 * Reads form_layout to render: browse grid → detail tabs → sections → fields → child grids.
 * Uses SplitCrudPage with metadata-driven columns and FormDetailTabs as detail body.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "@/context/SessionContext";
import { SplitCrudPage } from "../SplitCrudPage";
import type { CrudPanelBodyProps } from "@/components/panels/CrudPanel";
import { ColumnDef } from "@/components/data-grid/DataGrid";
import type { LayoutEntry, TableInfo, FormMeta, FormField, Row } from "./types";
import { humanize } from "./utils";
import { FieldPropertiesPanel } from "./panels/FieldPropertiesPanel";
import { SectionPropertiesPanel } from "./panels/SectionPropertiesPanel";
import { TabPropertiesPanel } from "./panels/TabPropertiesPanel";
import { AddFieldPanel } from "./panels/AddFieldPanel";
import { FormDetailTabs } from "./FormDetailTabs";

export function FormPage({ formKey, apiPath, activeNav, onNavigate }: {
  formKey: string;
  apiPath: string;
  activeNav: string;
  onNavigate: (k: string, oid?: string) => void;
}) {
  const [meta, setMeta] = useState<FormMeta | null>(null);
  const [error, setError] = useState("");
  const [designMode, setDesignMode] = useState(false);
  const [selectedField, setSelectedField] = useState<LayoutEntry | null>(null);
  const [selectedSection, setSelectedSection] = useState<LayoutEntry | null>(null);
  const [selectedTab, setSelectedTab] = useState<LayoutEntry | null>(null);
  const { user } = useSession();

  const handleFieldReordered = useCallback(async (
    dragOid: string,
    targetSection: string,
    targetEntryIdx: number,
    replaceSpacerOid?: string,
    appendOffset?: number,
  ) => {
    setMeta(prev => {
      if (!prev) return prev;
      const layout = [...prev.layout];
      const draggedIdx = layout.findIndex(l => l.oid === dragOid);
      if (draggedIdx < 0) return prev;
      const dragged = { ...layout[draggedIdx] };
      const tableName = dragged.table_name;
      const formKey = dragged.form_key ?? layout.find(l => l.form_key)?.form_key ?? "";
      const domain = dragged.domain ?? layout.find(l => l.domain)?.domain ?? "";

      // Get entries (fields + spacers) in target section, excluding dragged field
      let entries = layout
        .filter(l => (l.layout_type === "field" || l.layout_type === "spacer") && l.table_name === tableName && l.parent_key === targetSection && !l.properties?.hidden && l.oid !== dragOid)
        .sort((a, b) => a.sort_order - b.sort_order);

      const creates: LayoutEntry[] = [];
      const deletes: string[] = [];

      const mkSpacer = (): LayoutEntry => {
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
        return {
          oid: id, form_key: formKey, domain, table_name: tableName,
          layout_type: "spacer", layout_key: `spacer_${id.slice(0, 8)}`,
          parent_key: targetSection, sort_order: 0, properties: {},
        };
      };

      if (replaceSpacerOid) {
        // Drop on spacer: delete spacer, put field in its place
        const si = entries.findIndex(e => e.oid === replaceSpacerOid);
        if (si >= 0) { deletes.push(replaceSpacerOid); entries[si] = dragged; }
        else entries.push(dragged);
      } else if (appendOffset !== undefined && appendOffset >= 0) {
        // Drop on tail/append empty cell: add spacers for each gap cell, then the field
        for (let i = 0; i < appendOffset; i++) {
          const sp = mkSpacer();
          entries.push(sp);
          creates.push(sp);
        }
        entries.push(dragged);
      } else {
        // Drop on another field: insert before it (simple reorder, no spacers)
        const idx = Math.max(0, Math.min(targetEntryIdx, entries.length));
        entries.splice(idx, 0, dragged);
      }

      // Trim trailing spacers (no field after them = useless)
      while (entries.length > 0 && entries[entries.length - 1].layout_type === "spacer") {
        const trailing = entries.pop()!;
        if (creates.find(c => c.oid === trailing.oid)) {
          // Just created it — don't persist, remove from creates
          creates.splice(creates.findIndex(c => c.oid === trailing.oid), 1);
        } else {
          deletes.push(trailing.oid);
        }
      }

      // Renumber: 10, 20, 30...
      const updates = entries.map((e, i) => ({ oid: e.oid, sort_order: (i + 1) * 10, parent_key: targetSection }));

      // Build new layout
      const deleteSet = new Set(deletes);
      let newLayout = layout.filter(l => !deleteSet.has(l.oid));
      const existingOids = new Set(newLayout.map(l => l.oid));
      creates.forEach(c => { if (!existingOids.has(c.oid)) newLayout.push(c); });
      const updateMap = new Map(updates.map(u => [u.oid, u]));
      newLayout = newLayout.map(l => {
        const upd = updateMap.get(l.oid);
        return upd ? { ...l, sort_order: upd.sort_order, parent_key: upd.parent_key } : l;
      });

      // Persist
      const apiBase = "/api/form_layout?table=form_layout";
      const hdrs = { "Content-Type": "application/json" };
      creates.forEach(c => {
        fetch(apiBase, { method: "POST", headers: hdrs, body: JSON.stringify({ ...c, _table: "form_layout" }) }).catch(() => {});
      });
      deletes.forEach(d => {
        fetch(`${apiBase}&oid=${d}`, { method: "DELETE" }).catch(() => {});
      });
      updates.forEach(u => {
        fetch(apiBase, { method: "PUT", headers: hdrs, body: JSON.stringify({ oid: u.oid, _table: "form_layout", parent_key: u.parent_key, sort_order: u.sort_order }) }).catch(() => {});
      });

      return { ...prev, layout: newLayout };
    });
  }, []);

  const handleLayoutUpdated = useCallback((updatedLayout: LayoutEntry[]) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: updatedLayout };
    });
  }, []);

  const handleFieldAdded = useCallback((created: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: [...prev.layout, created] };
    });
  }, []);

  const DATA_TYPE_RENDERER: Record<string, string> = { text: 'text', integer: 'number', numeric: 'number', boolean: 'checkbox', date: 'date', timestamptz: 'datetime', citext: 'text' };

  const handleElementDropped = useCallback(async (
    data: any,
    targetSection: string,
    _targetEntryIdx: number,
    _replaceSpacerOid?: string,
    _appendOffset?: number,
  ) => {
    if (!meta) return;
    const headerTable = meta.headerTable;
    const fk = meta.layout.find(l => l.form_key)?.form_key ?? "";
    const domain = meta.layout.find(l => l.domain)?.domain ?? "*";

    // Calculate sort_order: append at end of target section
    const maxSort = meta.layout
      .filter(l => l.parent_key === targetSection && l.table_name === headerTable)
      .reduce((max, l) => Math.max(max, l.sort_order), -1);
    const sortOrder = maxSort + 10;

    try {
      if (data.type === "field") {
        // Check for hidden entry to unhide
        const hidden = meta.layout.find(l =>
          l.layout_type === "field" && l.table_name === headerTable &&
          l.layout_key === data.field_name && l.properties?.hidden
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const res = await fetch(`/api/form_layout?table=form_layout&oid=${hidden.oid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: restProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setMeta(prev => prev ? { ...prev, layout: prev.layout.map(l => l.oid === updated.oid ? updated : l) } : prev);
          }
        } else {
          const renderer = DATA_TYPE_RENDERER[data.data_type] || "text";
          const res = await fetch("/api/form_layout?table=form_layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: headerTable, layout_type: "field",
              layout_key: data.field_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: {
                label: data.field_name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
                renderer, colSpan: 1,
              },
            }),
          });
          if (res.ok) {
            const created = await res.json();
            setMeta(prev => prev ? { ...prev, layout: [...prev.layout, created] } : prev);
          }
        }
      } else if (data.type === "child_grid") {
        // Check for hidden grid entry
        const hidden = meta.layout.find(l =>
          l.layout_type === "child_grid" && l.layout_key === data.table_name && l.properties?.hidden
        );
        if (hidden) {
          const { hidden: _, ...restProps } = hidden.properties || {};
          const res = await fetch(`/api/form_layout?table=form_layout&oid=${hidden.oid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...hidden, parent_key: targetSection, sort_order: sortOrder, properties: restProps }),
          });
          if (res.ok) {
            const updated = await res.json();
            setMeta(prev => prev ? { ...prev, layout: prev.layout.map(l => l.oid === updated.oid ? updated : l) } : prev);
          }
        } else {
          const res = await fetch("/api/form_layout?table=form_layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              _table: "form_layout", domain, form_key: fk,
              table_name: headerTable, layout_type: "child_grid",
              layout_key: data.table_name, parent_key: targetSection,
              sort_order: sortOrder,
              properties: { label: data.tab_label || data.table_name, col_span: 99 },
            }),
          });
          if (res.ok) {
            const created = await res.json();
            setMeta(prev => prev ? { ...prev, layout: [...prev.layout, created] } : prev);
          }
        }
      }
    } catch (err) {
      console.error("Failed to place element:", err);
    }
  }, [meta]);

  const handleFieldSaved = useCallback((updated: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        layout: prev.layout.map(l => l.oid === updated.oid ? updated : l),
      };
    });
    setSelectedField(null);
  }, []);

  const handleSectionSaved = useCallback((updated: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: prev.layout.map(l => l.oid === updated.oid ? updated : l) };
    });
    setSelectedSection(null);
  }, []);

  const handleSectionDeleted = useCallback((oid: string) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: prev.layout.filter(l => l.oid !== oid) };
    });
    setSelectedSection(null);
  }, []);

  const handleSectionAdded = useCallback((created: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: [...prev.layout, created] };
    });
  }, []);

  const handleTabSaved = useCallback((updated: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: prev.layout.map(l => l.oid === updated.oid ? updated : l) };
    });
    setSelectedTab(null);
  }, []);

  const handleTabDeleted = useCallback((oid: string) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: prev.layout.filter(l => l.oid !== oid) };
    });
    setSelectedTab(null);
  }, []);

  const handleTabAdded = useCallback((created: LayoutEntry) => {
    setMeta(prev => {
      if (!prev) return prev;
      return { ...prev, layout: [...prev.layout, created] };
    });
  }, []);

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

        setMeta({
          tables: struct.tables,
          headerTable: struct.headerTable,
          layout: layoutData.rows || [],
          colTypes,
          colScales,
          fields: (fieldsData.rows || []).map((f: any) => ({
            field_name: f.field_name, data_type: f.data_type, table_name: f.table_name, is_nullable: f.is_nullable,
          })),
        });
      } catch (e: any) { setError(e.message); }
    })();
  }, [formKey, apiPath]);

  // Derive requiredFields from form_fields (NOT NULL, non-boolean)
  // overridden by form_layout properties.mandatory (true=force required, false=suppress)
  const requiredFields = useMemo<string[]>(() => {
    if (!meta) return [];
    const mandatoryMap = new Map<string, boolean>();
    for (const l of meta.layout) {
      if (l.layout_type === 'field' && l.table_name === meta.headerTable && l.properties?.mandatory != null) {
        mandatoryMap.set(l.layout_key, l.properties.mandatory as boolean);
      }
    }
    const result: string[] = [];
    for (const f of meta.fields) {
      if (f.table_name !== meta.headerTable) continue;
      const override = mandatoryMap.get(f.field_name);
      if (override === true) { result.push(f.field_name); continue; }
      if (override === false) continue; // designer suppressed it
      // No override: required if DB says NOT NULL and not boolean
      if (!f.is_nullable && f.data_type !== 'boolean') result.push(f.field_name);
    }
    // Also add layout-only mandatory=true fields (may not be in form_fields)
    for (const [key, val] of mandatoryMap) {
      if (val && !result.includes(key)) result.push(key);
    }
    return result;
  }, [meta]);

  // Derive columns and tabs from metadata
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    if (!meta) return [];
    return meta.layout
      .filter(l => l.layout_type === "grid_column" && l.table_name === meta.headerTable)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(gc => ({ key: gc.layout_key, label: gc.properties?.label }));
  }, [meta]);

  const headerTabs = useMemo(() =>
    meta ? meta.layout.filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable).sort((a, b) => a.sort_order - b.sort_order) : [],
    [meta],
  );

  // Design mode extra actions (only shown when design is on)
  const designExtraActions = useMemo(() => {
    if (!designMode) return [];
    return [];
  }, [designMode]);

  const renderBody = useCallback((props: CrudPanelBodyProps) => {
    if (!meta) return null;
    return (
      <FormDetailTabs
        apiPath={apiPath}
        meta={meta}
        headerTabs={headerTabs}
        row={props.row as Row}
        isNew={props.isNew}
        onChange={props.onChange as any}
        designMode={designMode}
        onFieldClick={designMode ? setSelectedField : undefined}
        onSectionClick={designMode ? setSelectedSection : undefined}
        onSectionAdded={designMode ? handleSectionAdded : undefined}
        onTabClick={designMode ? setSelectedTab : undefined}
        onTabAdded={designMode ? handleTabAdded : undefined}
        onFieldReordered={handleFieldReordered}
        onElementDropped={designMode ? handleElementDropped : undefined}
        onDesignToggle={() => setDesignMode(d => !d)}
        formKey={formKey}
        onLayoutUpdated={handleLayoutUpdated}
      />
    );
  }, [meta, apiPath, headerTabs, designMode, formKey, handleFieldReordered, handleElementDropped, handleLayoutUpdated, handleSectionAdded, handleTabAdded]);

  if (error) return <div style={{ padding: 24, color: "var(--danger-text)" }}>Error: {error}</div>;
  if (!meta) return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading form...</div>;

  return (
    <>
      <SplitCrudPage
        title={designMode ? `${formKey} — Design Mode` : formKey}
        table={meta.headerTable}
        apiPath={`${apiPath}?table=${meta.headerTable}`}
        columns={columns}
        requiredFields={requiredFields}
        renderBody={renderBody}
        extraActions={designExtraActions}
        designMode={designMode}
        onDesignToggle={() => setDesignMode(d => !d)}
        activeNav={activeNav}
        onNavigate={onNavigate}
      />
      <FieldPropertiesPanel
        entry={selectedField}
        open={!!selectedField}
        onClose={() => setSelectedField(null)}
        onSaved={handleFieldSaved}
        sections={meta ? meta.layout
          .filter(l => l.layout_type === "section" && l.table_name === meta.headerTable)
          .map(s => ({ key: s.layout_key, label: s.properties?.label || s.layout_key }))
          : []}
        sectionColumns={selectedField && meta ? (meta.layout.find(l => l.layout_type === "section" && l.layout_key === selectedField.parent_key)?.properties?.columns || 2) : 2}
      />
      {meta && (
        <AddFieldPanel
          open={!!designMode}
          onClose={() => {}}
          onAdded={handleFieldAdded}
          layout={meta.layout}
          fields={meta.fields}
          formKey={formKey}
          tableName={meta.headerTable}
          tables={meta.tables}
          sections={meta.layout
            .filter(l => l.layout_type === "section" && l.table_name === meta.headerTable)
            .map(s => ({ key: s.layout_key, label: s.properties?.label || s.layout_key }))}
        />
      )}
      <TabPropertiesPanel
        entry={selectedTab}
        open={!!selectedTab}
        onClose={() => setSelectedTab(null)}
        onSaved={handleTabSaved}
        onDeleted={handleTabDeleted}
        tabCount={meta ? meta.layout.filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable).length : 0}
      />
      <SectionPropertiesPanel
        entry={selectedSection}
        open={!!selectedSection}
        onClose={() => setSelectedSection(null)}
        onSaved={handleSectionSaved}
        onDeleted={handleSectionDeleted}
        tabs={meta ? meta.layout
          .filter(l => l.layout_type === "tab" && l.table_name === meta.headerTable)
          .map(t => ({ key: t.layout_key, label: t.properties?.label || t.layout_key }))
          : []}
      />
    </>
  );
}

export default FormPage;
