import { substitute } from "@/lib/substitute";
import { getBaseCatalog, getDefaultCatalog } from "./catalog";
import type { TranslationBundle, TranslationParams, TranslatableText } from "./types";
import { isTranslationSpec } from "./types";

export function mergeBundles(...bundles: Array<TranslationBundle | null | undefined>): TranslationBundle {
  return Object.assign({}, ...bundles.filter(Boolean));
}

export function getCatalogBundle(locale: string, overrides?: TranslationBundle | null): TranslationBundle {
  const normalized = locale.toLowerCase();
  if (normalized === "en-us") {
    return mergeBundles(getDefaultCatalog(), overrides);
  }
  return mergeBundles(getDefaultCatalog(), getBaseCatalog(normalized), overrides);
}

export function resolveText(
  value: TranslatableText | null | undefined,
  bundle: TranslationBundle,
  params?: TranslationParams,
): string {
  if (!value) return "";
  if (typeof value === "string") return substitute(value, params);

  const resolvedParams = value.params ? { ...value.params, ...params } : params;
  const raw = bundle[value.key] ?? value.fallback ?? value.key;
  return substitute(raw, resolvedParams);
}

export function splitTranslationKey(fullKey: string): { namespace: string; key: string } {
  const dotIdx = fullKey.indexOf(".");
  return dotIdx > 0
    ? { namespace: fullKey.slice(0, dotIdx), key: fullKey.slice(dotIdx + 1) }
    : { namespace: "global", key: fullKey };
}

export function resolveDbKey(fullKey: string, row: { namespace: string; key: string; value: string }[]): string | null {
  const { namespace, key } = splitTranslationKey(fullKey);
  const hit = row.find(entry => entry.namespace === namespace && entry.key === key);
  return hit?.value ?? null;
}

export function normalizeTranslatable(value: TranslatableText): TranslatableText {
  if (typeof value === "string" || isTranslationSpec(value)) return value;
  return "";
}
