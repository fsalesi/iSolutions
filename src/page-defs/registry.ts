import type { ReactNode } from "react";

/** Every page class must satisfy this shape. */
export interface PageInstance {
  title?: string;
  formKey: string;
  render(): ReactNode;
  getTitle?(): string;
}

type PageConstructor = new () => PageInstance;

/**
 * Registry — maps nav form keys to their customer page class.
 * Always import from @customer/pages/* so the customer layer gets priority.
 */
const registry: Record<string, () => Promise<PageConstructor>> = {
  sso_config: () =>
    import("@customer/pages/sso_config").then(m => m.SsoConfigPage),
  pasoe_brokers: () =>
    import("@customer/pages/pasoe_brokers").then(m => m.PasoeBrokersPage),
  users: () =>
    import("@customer/pages/users").then(m => m.UsersPage),
  groups: () =>
    import("@customer/pages/groups").then(m => m.GroupsPage),
  locales: () =>
    import("@customer/pages/locales").then(m => m.LocalesPage),
  translations: () =>
    import("@customer/pages/translations").then(m => m.TranslationsPage),
  settings: () =>
    import("@customer/pages/settings").then(m => m.SystemSettingsPage),
};

/** Resolve and instantiate a page by form key. Returns null if not registered. */
export async function resolvePage(formKey: string): Promise<PageInstance | null> {
  const loader = registry[formKey];
  if (!loader) return null;
  const PageClass = await loader();
  return new PageClass();
}
