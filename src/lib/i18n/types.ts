export type TranslationParams = Record<string, string | number>;

export interface TranslationSpec {
  key: string;
  fallback?: string;
  params?: TranslationParams;
}

export type TranslatableText = string | TranslationSpec;
export type TranslationBundle = Record<string, string>;

export function isTranslationSpec(value: TranslatableText | null | undefined): value is TranslationSpec {
  return !!value && typeof value === "object" && "key" in value && typeof value.key === "string";
}

export function tx(key: string, fallback?: string, params?: TranslationParams): TranslationSpec {
  return { key, fallback, params };
}
