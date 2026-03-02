/**
 * Replace {named} placeholders in a string with values from a params object.
 * Unreferenced placeholders are removed and extra whitespace is collapsed.
 *
 * substitute("Delegate {delegate} is not active", { delegate: "bob" })
 *   → "Delegate bob is not active"
 *
 * substitute("Delegate {delegate} is not active", {})
 *   → "Delegate is not active"
 */
export function substitute(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!template) return template;
  const result = template.replace(/\{(\w+)\}/g, (match, name) => {
    const val = params?.[name];
    return val !== undefined && val !== null ? String(val) : "";
  });
  // Collapse multiple spaces into one and trim
  return result.replace(/  +/g, " ").trim();
}
