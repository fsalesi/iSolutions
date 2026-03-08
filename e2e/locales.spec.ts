import { test, expect } from "@playwright/test";
import { authenticate, field, gotoForm, gridRow, reopenForm, savePanel } from "./test-helpers";

test.describe.serial("Locales page regressions", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("new locale flow clears key fields and shows required validation", async ({ page }) => {
    await gotoForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await gridRow(page, "locales").first().click();
    await expect(field(page, "code").locator("input").first()).not.toHaveValue("");

    await page.getByTestId("panel-toolbar-new").click();
    await expect(field(page, "code").locator("input").first()).toHaveValue("");
    await expect(field(page, "description").locator("input").first()).toHaveValue("");

    await page.getByTestId("panel-toolbar-save").click();
    await expect(field(page, "code")).toContainText("required");
    await expect(field(page, "description")).toContainText("required");
  });

  test("can update a locale description and restore it", async ({ page }) => {
    await gotoForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await gridRow(page, "locales").first().click();

    const code = await field(page, "code").locator("input").first().inputValue();
    const descriptionInput = field(page, "description").locator("input").first();
    const originalDescription = await descriptionInput.inputValue();
    const updatedDescription = originalDescription.includes("[PW]")
      ? originalDescription.replace(" [PW]", "")
      : `${originalDescription} [PW]`;

    await descriptionInput.fill(updatedDescription);
    await savePanel(page, "/api/locales");

    await reopenForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await page.getByText(code, { exact: true }).first().click();
    await expect(field(page, "description").locator("input").first()).toHaveValue(updatedDescription);

    await field(page, "description").locator("input").first().fill(originalDescription);
    await savePanel(page, "/api/locales");

    await reopenForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await page.getByText(code, { exact: true }).first().click();
    await expect(field(page, "description").locator("input").first()).toHaveValue(originalDescription);
  });

  test("can update locale separator format and restore it", async ({ page }) => {
    await gotoForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await page.getByText("cs", { exact: true }).first().click();

    const separatorSelect = field(page, "separator_char").locator("select");
    const originalValue = await separatorSelect.inputValue();
    const updatedValue = originalValue === "." ? "," : ".";

    await separatorSelect.selectOption(updatedValue);
    await savePanel(page, "/api/locales");

    await reopenForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await page.getByText("cs", { exact: true }).first().click();
    await expect(field(page, "separator_char").locator("select")).toHaveValue(updatedValue);

    await field(page, "separator_char").locator("select").selectOption(originalValue);
    await savePanel(page, "/api/locales");

    await reopenForm(page, "locales", "[data-testid=\"grid-search-locales\"]");
    await page.getByText("cs", { exact: true }).first().click();
    await expect(field(page, "separator_char").locator("select")).toHaveValue(originalValue);
  });
});
