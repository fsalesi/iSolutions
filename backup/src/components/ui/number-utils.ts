/**
 * number-utils.ts — Locale-aware number formatting and parsing.
 * Zero dependencies — uses native Intl.NumberFormat only.
 */

/** Format a number for display using locale conventions */
export function formatNumber(
  val: string | number | null | undefined,
  locale: string,
  scale: number = 0
): string {
  if (val == null || val === "") return "";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(n);
}

/** Parse a locale-formatted number string back to a plain number string for the API */
export function parseNumber(input: string, locale: string): string {
  if (!input.trim()) return "";
  const cleaned = input.trim();

  // Detect locale grouping/decimal separators
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find(p => p.type === "group")?.value ?? ",";
  const decimal = parts.find(p => p.type === "decimal")?.value ?? ".";

  // Strip grouping separators, replace decimal with "."
  let normalized = cleaned;
  // Remove all grouping chars
  normalized = normalized.split(group).join("");
  // Replace locale decimal with standard decimal
  if (decimal !== ".") {
    normalized = normalized.replace(decimal, ".");
  }

  // Remove any remaining non-numeric chars except . and -
  normalized = normalized.replace(/[^\d.\-]/g, "");

  const n = parseFloat(normalized);
  if (isNaN(n)) return "";
  return String(n);
}

/** Get the decimal separator for a locale */
export function getDecimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find(p => p.type === "decimal")?.value ?? ".";
}

/** Get the grouping separator for a locale */
export function getGroupSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345);
  return parts.find(p => p.type === "group")?.value ?? ",";
}
