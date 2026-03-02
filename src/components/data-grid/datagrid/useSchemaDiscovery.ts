import { useState, useEffect, useMemo } from "react";
import type { ColumnDef, ColType } from "./types";
import { humanize } from "./grid-utils";

export interface SchemaResult<T> {
  columns: ColumnDef<T>[];
  colTypes: Record<string, ColType>;
  colScales: Record<string, number>;
}

/**
 * Fetches column metadata from /api/columns and merges with page-level overrides.
 * Returns the final columns, colTypes, and colScales.
 */
export function useSchemaDiscovery<T>(
  table: string | undefined,
  columnOverrides: ColumnDef<T>[] | undefined,
  colTypesProp: Record<string, ColType>,
  colScalesProp: Record<string, number>,
): SchemaResult<T> {
  const [schemaCols, setSchemaCols] = useState<ColumnDef<T>[]>([]);
  const [schemaColTypes, setSchemaColTypes] = useState<Record<string, ColType>>({});
  const [schemaColScales, setSchemaColScales] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!table) return;
    fetch(`/api/columns?table=${table}`).then(r => r.json()).then((cols: { key: string; type: string; scale?: number }[]) => {
      const types: Record<string, ColType> = {};
      const scales: Record<string, number> = {};
      const defs: ColumnDef<T>[] = [];
      for (const col of cols) {
        types[col.key] = col.type as ColType;
        if (col.scale !== undefined) scales[col.key] = col.scale;
        defs.push({ key: col.key as keyof T & string, label: humanize(col.key) });
      }
      setSchemaColTypes(types);
      setSchemaColScales(scales);
      setSchemaCols(defs);
    }).catch(() => {});
  }, [table]);

  // Merge schema + overrides into final columns list
  const columns: ColumnDef<T>[] = useMemo(() => {
    const overrides = columnOverrides || [];
    if (schemaCols.length === 0) {
      return overrides.length > 0
        ? overrides.filter(c => !c.hidden).map(c => ({ ...c, label: c.label || humanize(c.key) }))
        : [];
    }
    if (overrides.length === 0) return schemaCols;

    const overrideMap = new Map(overrides.map(o => [o.key, o]));
    const seen = new Set<string>();
    const result: ColumnDef<T>[] = [];
    for (const sc of schemaCols) {
      const ov = overrideMap.get(sc.key);
      seen.add(sc.key);
      if (ov?.hidden) continue;
      result.push(ov ? { ...sc, ...ov, label: ov.label || sc.label } : sc);
    }
    for (const ov of overrides) {
      if (!seen.has(ov.key) && !ov.hidden) {
        result.push({ ...ov, label: ov.label || humanize(ov.key) });
      }
    }
    return result;
  }, [schemaCols, columnOverrides]);

  // Merge colTypes/colScales: schema + prop overrides
  const colTypes = useMemo(() => ({ ...schemaColTypes, ...colTypesProp }), [schemaColTypes, colTypesProp]);
  const colScales = useMemo(() => ({ ...schemaColScales, ...colScalesProp }), [schemaColScales, colScalesProp]);

  return { columns, colTypes, colScales };
}
