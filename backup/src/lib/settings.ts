import { db } from "@/lib/db";

/**
 * Settings cascade lookup.
 *
 * Resolution order (first match wins):
 *   1. owner + form + domain     (most specific)
 *   2. owner + form + '*'        (form-specific, any domain)
 *   3. owner + ''   + domain     (no form, specific domain)
 *   4. owner + ''   + '*'        (global fallback for owner)
 *
 * For getSystemSetting, owner is always 'SYSTEM'.
 * For getUserSetting, owner is the userId.
 * For getSetting, user-level is checked first, then system-level.
 */

interface GetSettingOpts {
  form?: string;
  domain?: string;
}

/**
 * Look up a setting with full cascade: user first, then system.
 */
export async function getSetting(
  settingName: string,
  userId: string,
  opts: GetSettingOpts = {}
): Promise<string | null> {
  // Try user-level first
  const userVal = await getUserSetting(settingName, userId, opts);
  if (userVal !== null) return userVal;
  // Fall back to system
  return getSystemSetting(settingName, opts);
}

/**
 * Look up a system-level setting (owner = 'SYSTEM').
 */
export async function getSystemSetting(
  settingName: string,
  opts: GetSettingOpts = {}
): Promise<string | null> {
  return cascadeLookup("SYSTEM", settingName, opts);
}

/**
 * Look up a user-level setting.
 */
export async function getUserSetting(
  settingName: string,
  userId: string,
  opts: GetSettingOpts = {}
): Promise<string | null> {
  return cascadeLookup(userId, settingName, opts);
}

/**
 * Core cascade: tries 4 levels from most to least specific.
 */
async function cascadeLookup(
  owner: string,
  settingName: string,
  opts: GetSettingOpts
): Promise<string | null> {
  const form = opts.form ?? "";
  const domain = opts.domain ?? "*";

  // Build candidates in priority order
  const candidates: [string, string][] = [];

  if (form && domain !== "*") {
    candidates.push([form, domain]);   // 1. form + domain
  }
  if (form) {
    candidates.push([form, "*"]);      // 2. form + any domain
  }
  if (domain !== "*") {
    candidates.push(["", domain]);     // 3. no form + domain
    candidates.push(["*", domain]);    // 3b. wildcard form + specific domain
  }
  candidates.push(["", "*"]);          // 4. global fallback (form blank)
  candidates.push(["*", "*"]);         // 4b. global fallback (form wildcard)

  // Single query: fetch all matching rows, then pick best match in JS
  const { rows } = await db.query(
    `SELECT form, domain, value
       FROM settings
      WHERE owner = $1
        AND setting_name = $2
        AND form   IN ($3, '', '*')
        AND domain IN ($4, '*')`,
    [owner, settingName, form, domain]
  );

  if (rows.length === 0) return null;

  // Build a map for quick lookup
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(`${r.form}|${r.domain}`, r.value);
  }

  // Return first match in priority order
  for (const [f, d] of candidates) {
    const key = `${f}|${d}`;
    if (map.has(key)) return map.get(key)!;
  }

  return null;
}

/**
 * Convenience: get a setting as boolean.
 */
export async function getSettingBool(
  settingName: string,
  userId: string,
  opts: GetSettingOpts = {}
): Promise<boolean> {
  const val = await getSetting(settingName, userId, opts);
  if (!val) return false;
  return ["true", "yes", "1"].includes(val.toLowerCase());
}

/**
 * Convenience: get a setting as number.
 */
export async function getSettingNumber(
  settingName: string,
  userId: string,
  opts: GetSettingOpts = {}
): Promise<number | null> {
  const val = await getSetting(settingName, userId, opts);
  if (!val) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}
