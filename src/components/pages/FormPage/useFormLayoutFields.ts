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

        const schemaRes = await fetch(`/api/table_schema?tables=${encodeURIComponent(tablesKey)}`);

        const layoutData = await layoutRes.json();
        const schemaData = await schemaRes.json();

        if (cancelled) return;

        setLayout(layoutData.rows || []);
        setFields((schemaData.rows || []).map((f: RawField) => ({
          field_name: f.field_name,
          data_type: f.data_type,
          table_name: f.table_name,
          is_nullable: f.is_nullable,
          scale: f.scale,
        })));
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
