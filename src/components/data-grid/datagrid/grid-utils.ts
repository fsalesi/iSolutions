import { formatDate } from "@/components/ui/date-utils";
import { formatNumber } from "@/components/ui/number-utils";
import type { ColType } from "./types";

/** Convert column key to human-readable label */
export function humanize(key: string): string {
  let s = key.replace(/_id$/, "").replace(/_nbr$/, "_number");
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Column alignment by data type */
export function colAlign(key: string, colTypes: Record<string, ColType>): "left" | "right" | "center" {
  const ct = colTypes[key];
  if (ct === "number") return "right";
  if (ct === "boolean") return "center";
  return "left";
}

/** Auto-format cell values by column type */
export function formatCellValue(
  val: any, key: string, colTypes: Record<string, ColType>,
  locale: string, colScales: Record<string, number> = {}
): string {
  if (val == null || val === "") return "";
  const ct = colTypes[key];
  if (ct === "datetime") return formatDate(String(val), locale, "datetime");
  if (ct === "date") return formatDate(String(val), locale, "date");
  if (ct === "number") return formatNumber(val, locale, colScales[key] ?? 0);
  if (ct === "boolean") return val ? "✓" : "";
  return String(val);
}
