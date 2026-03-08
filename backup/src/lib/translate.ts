/**
 * Server-side translation resolver.
 * Looks up a "namespace.key" in the translations table for a given locale,
 * substitutes {named} params, and returns the resolved string.
 *
 * Falls back to system default locale, then to the raw key.
 */
import { db } from "@/lib/db";
import { substitute } from "@/lib/substitute";

/**
 * Translate a message key for a given locale.
 *
 *   await translateMessage("en-us", "message.delegate_inactive", { delegate: "bob" })
 *   → "Delegate bob is not an active user"
 */
export async function translateMessage(
  locale: string,
  fullKey: string,
  params?: Record<string, string | number>,
): Promise<string> {
  // Split "message.delegate_inactive" → namespace="message", key="delegate_inactive"
  const dotIdx = fullKey.indexOf(".");
  const namespace = dotIdx > 0 ? fullKey.slice(0, dotIdx) : "global";
  const key = dotIdx > 0 ? fullKey.slice(dotIdx + 1) : fullKey;

  // Try requested locale first
  const res = await db.query(
    `SELECT value FROM translations
     WHERE locale = $1 AND namespace = $2 AND key = $3`,
    [locale, namespace, key]
  );

  if (res.rows.length) {
    return substitute(res.rows[0].value, params);
  }

  // Fall back to system default locale
  if (locale !== "en-us") {
    const fallback = await db.query(
      `SELECT value FROM translations
       WHERE locale = (SELECT code FROM locales WHERE is_default = true LIMIT 1)
         AND namespace = $1 AND key = $2`,
      [namespace, key]
    );
    if (fallback.rows.length) {
      return substitute(fallback.rows[0].value, params);
    }
  }

  // Last resort: substitute into the key itself (returns key with params stripped)
  return substitute(fullKey, params);
}

/**
 * Get the locale for a user by user_id.
 * Falls back to "en-us" if not set.
 */
export async function getUserLocale(userId: string): Promise<string> {
  if (!userId) return "en-us";
  const res = await db.query(
    `SELECT locale FROM users WHERE user_id = $1`,
    [userId]
  );
  return res.rows[0]?.locale || "en-us";
}
