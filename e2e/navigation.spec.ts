import { test, expect } from "@playwright/test";
import { authenticate, gotoForm, navigateViaSidebar } from "./test-helpers";

test.describe("Navigation regressions", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("sidebar navigation keeps title, panel, and grid in sync", async ({ page }) => {
    await gotoForm(page, "users", '[data-testid="grid-search-users"]');
    await expect(page.locator("header").getByText("Users", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-users"]')).toBeVisible();

    await navigateViaSidebar(page, "System Settings", '[data-testid="grid-search-settings"]');
    await expect(page.locator("header").getByText("System Settings", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-settings"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-users"]')).toHaveCount(0);

    await navigateViaSidebar(page, "Locales", '[data-testid="grid-search-locales"]');
    await expect(page.locator("header").getByText("Locales", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-locales"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-settings"]')).toHaveCount(0);

    await navigateViaSidebar(page, "Users", '[data-testid="grid-search-users"]');
    await expect(page.locator("header").getByText("Users", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-search-locales"]')).toHaveCount(0);
  });
});
