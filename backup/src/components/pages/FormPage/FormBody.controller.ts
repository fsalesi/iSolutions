/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { LayoutEntry, FormField, Row, FormMeta, FormStructure } from "./types";
import type { ColumnDef } from "@/components/data-grid/DataGrid";
import { useDesignLayout } from "./useDesignLayout";
import { useFormLayoutFields } from "./useFormLayoutFields";

export type Design = ReturnType<typeof useDesignLayout>;

export interface FormDesignBindings {
  designMode: boolean;
  onFieldClick?: (entry: LayoutEntry) => void;
  onSectionClick?: (entry: LayoutEntry) => void;
  onSectionAdded?: (entry: LayoutEntry) => void;
  onTabClick?: (entry: LayoutEntry) => void;
  onTabAdded?: (entry: LayoutEntry) => void;
  onFieldMoved?: (oid: string, targetSection: string, targetRow: number, targetCol: number) => void;
  onElementDropped?: (data: unknown, targetSection: string, targetRow: number, targetCol: number) => void;
  onDesignToggle?: () => void;
}

interface UseFormDesignControllerArgs {
  tableName: string;
  formKey?: string;
  layout: LayoutEntry[];
  defaultTabKey: string;
  defaultTabLabel: string;
}

interface UseFormBodyControllerArgs {
  tableName: string;
  formKey?: string;
  tableNames?: string[];
  columns?: ColumnDef<Row>[];
  defaultTabKey: string;
  defaultTabLabel: string;
}

export interface FormColumnTypes {
  colTypes: Record<string, string>;
  colScales: Record<string, number>;
}

export function getFormStatus(error?: string, loading?: boolean, loadingLabel = "Loading form...") {
  if (error) return { text: `Error: ${error}`, color: "var(--danger-text)" };
  if (loading) return { text: loadingLabel, color: "var(--text-muted)" };
  return null;
}

export function buildFormDesignBindings(design: Design, onDesignToggle?: () => void): FormDesignBindings {
  const designMode = design.designMode;
  return {
    designMode,
    onFieldClick: designMode ? design.setSelectedField : undefined,
    onSectionClick: designMode ? design.setSelectedSection : undefined,
    onSectionAdded: designMode ? design.handleSectionAdded : undefined,
    onTabClick: designMode ? design.setSelectedTab : undefined,
    onTabAdded: designMode ? design.handleTabAdded : undefined,
    onFieldMoved: design.handleFieldMoved,
    onElementDropped: designMode ? design.handleElementDropped : undefined,
    onDesignToggle,
  };
}

export function buildFormMeta(structure: FormStructure | null, fields: FormField[]): FormMeta | null {
  if (!structure) return null;
  const { colTypes, colScales } = buildColumnTypes(fields);
  return {
    tables: structure.tables,
    headerTable: structure.headerTable,
    layout: [],
    colTypes,
    colScales,
    fields,
  };
}

export function useFormStructure(apiPath: string) {
  const [structure, setStructure] = useState<FormStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const structRes = await fetch(apiPath);
        const struct = await structRes.json();
        if (!struct.headerTable) {
          if (!cancelled) {
            setStructure(null);
            setError("Form has no header table");
          }
          return;
        }

        if (!cancelled) {
          setStructure({
            tables: struct.tables || [],
            headerTable: struct.headerTable,
          });
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to load form structure";
          setStructure(null);
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiPath]);

  return { structure, loading, error };
}

export function buildColumnTypes(fields: FormField[]): FormColumnTypes {
  const colTypes: Record<string, string> = {
    oid: "text",
    domain: "text",
    created_at: "datetime",
    created_by: "text",
    updated_at: "datetime",
    updated_by: "text",
  };
  const colScales: Record<string, number> = {};

  for (const f of fields) {
    switch (f.data_type) {
      case "integer":
        colTypes[f.field_name] = "number";
        colScales[f.field_name] = 0;
        break;
      case "numeric":
        colTypes[f.field_name] = "number";
        colScales[f.field_name] = f.scale ?? 2;
        break;
      case "boolean":
        colTypes[f.field_name] = "boolean";
        break;
      case "date":
        colTypes[f.field_name] = "date";
        break;
      case "timestamptz":
        colTypes[f.field_name] = "datetime";
        break;
      default:
        colTypes[f.field_name] = "text";
    }
  }

  return { colTypes, colScales };
}

export function buildRequiredFields(layout: LayoutEntry[], fields: FormField[], tableName: string): string[] {
  if (!tableName) return [];

  const mandatoryMap = new Map<string, boolean>();
  for (const l of layout) {
    if (l.layout_type === "field" && l.table_name === tableName && l.properties?.mandatory != null) {
      mandatoryMap.set(l.layout_key, l.properties.mandatory as boolean);
    }
  }

  const result: string[] = [];
  for (const f of fields) {
    if (f.table_name !== tableName) continue;
    const override = mandatoryMap.get(f.field_name);
    if (override === true) {
      result.push(f.field_name);
      continue;
    }
    if (override === false) continue;
    if (!f.is_nullable && f.data_type !== "boolean") result.push(f.field_name);
  }

  for (const [key, val] of mandatoryMap) {
    if (val && !result.includes(key)) result.push(key);
  }

  return result;
}

export function buildGridColumns(layout: LayoutEntry[], tableName: string): ColumnDef<Row>[] {
  if (!tableName) return [];

  return layout
    .filter((l) => l.layout_type === "grid_column" && l.table_name === tableName)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((gc) => ({ key: gc.layout_key, label: gc.properties?.label }));
}

export function useFormBodyController({
  tableName,
  formKey,
  tableNames,
  columns,
  defaultTabKey,
  defaultTabLabel,
}: UseFormBodyControllerArgs) {
  const metadataTables = useMemo(() => {
    const source = tableNames && tableNames.length > 0 ? tableNames : [tableName];
    return Array.from(new Set(source.filter(Boolean)));
  }, [tableName, tableNames]);

  const { layout, fields, loading, error } = useFormLayoutFields({
    formKey,
    tableNames: metadataTables,
  });

  const { design, handleDesignToggle } = useFormDesignController({
    tableName,
    formKey,
    layout,
    defaultTabKey,
    defaultTabLabel,
  });

  const effectiveFields = useMemo<FormField[]>(() => {
    if (fields.length > 0 || !columns) return fields;
    return columns.map((col) => ({
      field_name: String(col.key),
      data_type: "text",
      table_name: tableName,
      is_nullable: true,
    }));
  }, [fields, columns, tableName]);

  return {
    layout,
    fields,
    effectiveFields,
    loading,
    error,
    design,
    handleDesignToggle,
  };
}

export async function bootstrapDesignLayout({
  formKey,
  tableName,
  tabKey,
  tabLabel,
  layout,
  setLayout,
  onTabCreated,
}: {
  formKey: string;
  tableName: string;
  tabKey: string;
  tabLabel: string;
  layout: LayoutEntry[];
  setLayout: (fn: (prev: LayoutEntry[]) => LayoutEntry[]) => void;
  onTabCreated?: (tabKey: string) => void;
}): Promise<void> {
  const hasTabs = layout.some(
    (l) => l.layout_type === "tab" && l.table_name === tableName
  );
  if (hasTabs) return;

  try {
    const tabRes = await fetch("/api/form_layout?table=form_layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _table: "form_layout", domain: "*", form_key: formKey,
        table_name: tableName, layout_type: "tab",
        layout_key: tabKey, parent_key: "", sort_order: 10,
        properties: { label: tabLabel },
      }),
    });
    const tab = tabRes.ok ? await tabRes.json() : null;

    const existingSections = layout.filter(
      (l) => l.layout_type === "section" && l.table_name === tableName
    );

    if (existingSections.length === 0) {
      const secRes = await fetch("/api/form_layout?table=form_layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _table: "form_layout", domain: "*", form_key: formKey,
          table_name: tableName, layout_type: "section",
          layout_key: `${tabKey}_details`, parent_key: tabKey, sort_order: 10,
          properties: { label: "Details", columns: 2 },
        }),
      });
      const sec = secRes.ok ? await secRes.json() : null;
      if (tab) setLayout((prev) => [...prev, tab, ...(sec ? [sec] : [])]);
    } else {
      if (tab) setLayout((prev) => [...prev, tab]);
    }

    if (tab && onTabCreated) onTabCreated(tabKey);
  } catch {
    // proceed anyway
  }
}

export function useFormDesignController({
  tableName,
  formKey,
  layout,
  defaultTabKey,
  defaultTabLabel,
}: UseFormDesignControllerArgs) {
  const design = useDesignLayout([], tableName);

  useEffect(() => {
    design.setLayout(layout);
  }, [layout]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDesignToggle = useCallback(async () => {
    const isEntering = !design.designMode;
    if (isEntering && formKey) {
      await bootstrapDesignLayout({
        formKey,
        tableName,
        tabKey: defaultTabKey,
        tabLabel: defaultTabLabel,
        layout: design.layout,
        setLayout: design.setLayout,
      });
    }
    design.toggleDesignMode();
  }, [design, formKey, tableName, defaultTabKey, defaultTabLabel]);

  return { design, handleDesignToggle };
}
