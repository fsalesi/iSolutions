/* IMPORTANT: RUNTIME FORMS RULE - DO NOT use form_fields anywhere in runtime forms code. Use table_schema/information_schema (+ form_tables for structure) instead. */
"use client";

import { useEffect, useState } from "react";
import type { FormField, LayoutEntry } from "./types";

interface RawField extends FormField {
  scale?: number;
}

interface UseFormLayoutFieldsArgs {
  formKey?: string;
  tableNames: string[];
}

interface UseFormLayoutFieldsResult {
  layout: LayoutEntry[];
  fields: FormField[];
  loading: boolean;
  error: string;
}

export function useFormLayoutFields({ formKey, tableNames }: UseFormLayoutFieldsArgs): UseFormLayoutFieldsResult {
  const [layout, setLayout] = useState<LayoutEntry[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedTables = Array.from(new Set(tableNames.filter(Boolean)));
  const tablesKey = normalizedTables.join(",");

  useEffect(() => {
    if (!formKey || !tablesKey) {
      setLayout([]);
      setFields([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const layoutRes = await fetch(
          `/api/form_layout?filters=${encodeURIComponent(
            JSON.stringify({
              type: "group",
              logic: "and",
              children: [
                { type: "condition", field: "form_key", operator: "eq", value: formKey },
              ],
            })
          )}&limit=500`
        );

        const layoutData = await layoutRes.json();

        const columnResults = await Promise.all(
          normalizedTables.map(async (tn) => {
            const res = await fetch(`/api/columns?table=${encodeURIComponent(tn)}&form_key=${encodeURIComponent(formKey)}`);
            const cols = await res.json();
            return { table: tn, cols: Array.isArray(cols) ? cols : [] };
          })
        );

        if (cancelled) return;

        setLayout(layoutData.rows || []);
        setFields(
          columnResults.flatMap(({ table, cols }) =>
            cols.map((c: { key: string; type: string; nullable?: boolean; scale?: number }) => {
              const rawType = String(c.type || "text");
              let data_type = "text";
              if (rawType === "number") {
                data_type = c.scale === 0 ? "integer" : "numeric";
              } else if (rawType === "boolean") {
                data_type = "boolean";
              } else if (rawType === "date") {
                data_type = "date";
              } else if (rawType === "datetime") {
                data_type = "timestamptz";
              }
              return {
                field_name: c.key,
                data_type,
                table_name: table,
                is_nullable: c.nullable ?? true,
                scale: c.scale,
              } as RawField;
            })
          )
        );
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Failed to load form metadata";
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formKey, tablesKey]);

  return { layout, fields, loading, error };
}
