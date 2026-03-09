import type { ReactNode } from "react";

/** Every page class must satisfy this shape. */
export interface PageInstance {
  title?: string;
  formKey: string;
  show(): ReactNode;
  getTitle?(): string;
}

type PageConstructor = new () => PageInstance;

/**
 * Registry — maps nav form keys to page classes.
 *
 * Platform pages:  import directly from @/platform/pages/* (no customer override chain).
 * Enduser pages:   import from @customer/pages/* so the customer layer can override at every level.
 */
const registry: Record<string, () => Promise<PageConstructor>> = {
  // ── Platform pages ─────────────────────────────────────────────────
  sso_config:    () => import("@/platform/pages/sso_config").then(m => m.SsoConfigPage),
  pasoe_brokers: () => import("@/platform/pages/pasoe_brokers").then(m => m.PasoeBrokersPage),
  users:         () => import("@/platform/pages/users").then(m => m.UsersPage),
  groups:        () => import("@/platform/pages/groups").then(m => m.GroupsPage),
  locales:       () => import("@/platform/pages/locales").then(m => m.LocalesPage),
  translations:  () => import("@/platform/pages/translations").then(m => m.TranslationsPage),
  settings:      () => import("@/platform/pages/settings").then(m => m.SystemSettingsPage),

  // ── Enduser pages (customer-overridable) ───────────────────────────
  requisition:   () => import("@customer/pages/requisition").then(m => m.RequisitionPage),
};

/** Resolve and instantiate a page by form key. Returns null if not registered. */
export async function resolvePage(formKey: string): Promise<PageInstance | null> {
  const loader = registry[formKey];
  if (!loader) return null;
  const PageClass = await loader();
  return new PageClass();
}
