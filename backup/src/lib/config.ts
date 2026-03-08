/**
 * Application configuration.
 *
 * All settings read from environment variables so nothing is hard-coded.
 * Add new sections here as the app grows (auth, email, storage, etc.).
 */

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var: ${key}. Check .env.local`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  /** PostgreSQL connection */
  db: {
    url: required("DATABASE_URL"),
  },
} as const;
