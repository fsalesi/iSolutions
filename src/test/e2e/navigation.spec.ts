import { test, expect, type Page } from "@playwright/test";

function expectTitle(page: Page, pattern: RegExp) {
  return expect(page.locator("header").getByText(pattern)).toBeVisible({ timeout: 15000 });
}
import { authenticate, gotoForm, navigateViaSidebar } from "./test-helpers";

test.describe("Navigation regressions", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("sidebar navigation keeps title, panel, and grid in sync", async ({ page }) => {
    await gotoForm(page, "users", '[data-testid="grid-search-users"]');
    await expectTitle(page, /Users|Utenti/i);
    await expect(page.locator('[data-testid="grid-search-users"]')).toBeVisible();

    await navigateViaSidebar(page, /System Settings|Impostazioni di sistema/i, '[data-testid="grid-search-settings"]');
    await expectTitle(page, /System Settings|Impostazioni di sistema/i);
    await expect(page.locator('[data-testid="grid-search-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-users"]')).toHaveCount(0);

    await navigateViaSidebar(page, /Locales|Locali/i, '[data-testid="grid-search-locales"]');
    await expect(page.locator("header").getByText("Locales", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-locales"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-settings"]')).toHaveCount(0);

    await navigateViaSidebar(page, /Users|Utenti/i, '[data-testid="grid-search-users"]');
    await expectTitle(page, /Users|Utenti/i);
    await expect(page.locator('[data-testid="grid-search-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-locales"]')).toHaveCount(0);
  });
});
