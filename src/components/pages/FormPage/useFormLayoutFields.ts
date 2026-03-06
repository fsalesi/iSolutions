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

        const targetTables = tablesKey.split(",");
        const fieldOperator = targetTables.length === 1 ? "eq" : "in_list";
        const fieldValue = targetTables.length === 1 ? targetTables[0] : tablesKey;

        const fieldsRes = await fetch(
          `/api/form_fields?filters=${encodeURIComponent(
            JSON.stringify({
              type: "group",
              logic: "and",
              children: [
                { type: "condition", field: "form_key", operator: "eq", value: formKey },
                { type: "condition", field: "table_name", operator: fieldOperator, value: fieldValue },
              ],
            })
          )}&limit=500`
        );

        const layoutData = await layoutRes.json();
        const fieldsData = await fieldsRes.json();

        if (cancelled) return;

        setLayout(layoutData.rows || []);
        setFields((fieldsData.rows || []).map((f: RawField) => ({
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
