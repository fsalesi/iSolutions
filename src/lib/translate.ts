import { db } from "@/lib/db";
import { getCatalogBundle, resolveText, splitTranslationKey } from "@/lib/i18n/resolve";
import type { TranslationBundle, TranslationParams } from "@/lib/i18n/types";

async function getDbOverrides(locale: string): Promise<TranslationBundle> {
  const { rows } = await db.query(
    `SELECT namespace, key, value FROM translations WHERE locale = $1`,
    [locale]
  );

  const bundle: TranslationBundle = {};
  for (const row of rows) {
    bundle[`${row.namespace}.${row.key}`] = row.value;
  }
  return bundle;
}

export async function translateMessage(
  locale: string,
  fullKey: string,
  params?: TranslationParams,
  fallback?: string,
): Promise<string> {
  const overrides = await getDbOverrides(locale);
  return resolveText({ key: fullKey, fallback }, getCatalogBundle(locale, overrides), params);
}

export async function getTranslationBundle(locale: string): Promise<TranslationBundle> {
  const overrides = await getDbOverrides(locale);
  return getCatalogBundle(locale, overrides);
}

export async function setTranslationOverride(
  locale: string,
  fullKey: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  const { namespace, key } = splitTranslationKey(fullKey);
  await db.query(
    `INSERT INTO translations (locale, namespace, key, value, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (locale, namespace, key) DO UPDATE SET value = $4, updated_by = $5`,
    [locale, namespace, key, value, updatedBy]
  );
}

export async function getUserLocale(userId: string): Promise<string> {
  if (!userId) return "en-us";
  const res = await db.query(
    `SELECT locale FROM users WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0]?.locale || "en-us";
}
