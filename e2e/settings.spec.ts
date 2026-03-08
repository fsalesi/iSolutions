import { test, expect } from "@playwright/test";
import { authenticate, field, gotoForm, reopenForm, savePanel } from "./test-helpers";

const TARGET_SETTING = "APPROVALS_ROLE_SCOPE_TYPES";

test.describe.serial("Settings page regressions", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("new setting flow clears key fields and shows required validation", async ({ page }) => {
    await gotoForm(page, "settings", "[data-testid=\"grid-search-settings\"]");
    await page.getByText("ALLOWED_DOMAINS", { exact: true }).first().click();
    await expect(field(page, "setting_name").locator("input").first()).toHaveValue("ALLOWED_DOMAINS");

    await page.getByTestId("panel-toolbar-new").click();
    await expect(field(page, "setting_name").locator("input").first()).toHaveValue("");

    await page.getByTestId("panel-toolbar-save").click();
    await expect(field(page, "setting_name")).toContainText("required");
    await expect(field(page, "domain")).toContainText("required");
  });

  test("can update setting help text and restore it", async ({ page }) => {
    await gotoForm(page, "settings", "[data-testid=\"grid-search-settings\"]");
    await page.getByTestId("grid-search-settings").fill(TARGET_SETTING);
    await expect(page.getByText(TARGET_SETTING, { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(TARGET_SETTING, { exact: true }).first().click();

    const helpInput = field(page, "help_text").locator("textarea");
    const originalHelp = await helpInput.inputValue();
    const updatedHelp = originalHelp.includes("[PW]")
      ? originalHelp.replace(" [PW]", "")
      : `${originalHelp} [PW]`;

    await helpInput.fill(updatedHelp);
    await savePanel(page, "/api/settings");

    await reopenForm(page, "settings", "[data-testid=\"grid-search-settings\"]");
    await page.getByTestId("grid-search-settings").fill(TARGET_SETTING);
    await expect(page.getByText(TARGET_SETTING, { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(TARGET_SETTING, { exact: true }).first().click();
    await expect(field(page, "help_text").locator("textarea")).toHaveValue(updatedHelp);

    await field(page, "help_text").locator("textarea").fill(originalHelp);
    await savePanel(page, "/api/settings");

    await reopenForm(page, "settings", "[data-testid=\"grid-search-settings\"]");
    await page.getByTestId("grid-search-settings").fill(TARGET_SETTING);
    await expect(page.getByText(TARGET_SETTING, { exact: true }).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(TARGET_SETTING, { exact: true }).first().click();
    await expect(field(page, "help_text").locator("textarea")).toHaveValue(originalHelp);
  });
});
