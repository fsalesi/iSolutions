import { getCatalogBundle, resolveText } from "./resolve";
import type { TranslationBundle, TranslationParams, TranslatableText } from "./types";

let currentLocale = "en-us";
let currentBundle: TranslationBundle = getCatalogBundle(currentLocale);

export function setClientTranslations(locale: string, overrides?: TranslationBundle | null): void {
  currentLocale = locale.toLowerCase();
  currentBundle = getCatalogBundle(currentLocale, overrides);
}

export function getClientLocale(): string {
  return currentLocale;
}

export function getClientBundle(): TranslationBundle {
  return currentBundle;
}

export function resolveClientText(value: TranslatableText | null | undefined, params?: TranslationParams): string {
  return resolveText(value, currentBundle, params);
}
