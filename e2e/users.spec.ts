import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const AUTH_COOKIE = {
  name: "isolutions-user",
  value: "frank",
  domain: "localhost",
  path: "/",
  secure: false,
  httpOnly: false,
  sameSite: "Lax" as const,
};

async function authenticate(context: BrowserContext) {
  await context.addCookies([AUTH_COOKIE]);
}

async function gotoUsers(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("grid-toolbar-columns")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("adriel", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

async function reopenUsers(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("adriel", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

async function selectUser(page: Page, userId: string) {
  await page.getByText(userId, { exact: true }).first().click();
  await expect(page.getByTestId("field-user_id").locator(`input[value="${userId}"]`)).toBeVisible();
}

function field(page: Page, key: string) {
  return page.getByTestId(`field-${key}`);
}

async function savePanel(page: Page) {
  const saveButton = page.getByTestId("panel-toolbar-save");
  await expect(saveButton).toBeEnabled();
  const responsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/users") && ["PUT", "POST"].includes(response.request().method());
  });
  await saveButton.click();
  const response = await responsePromise;
  expect(response.ok(), `Save failed with status ${response.status()}`).toBeTruthy();
  await expect(saveButton).toBeDisabled({ timeout: 10000 });
}

async function openDetailsTab(page: Page) {
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(field(page, "title")).toBeVisible();
}

async function openSettingsTab(page: Page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(field(page, "supervisor_id")).toBeVisible();
}

async function setLookupValue(page: Page, fieldKey: string, dialogTitle: string, value: string) {
  const container = field(page, fieldKey);
  await container.getByTitle("Browse").click();
  const modal = page.getByTestId("lookup-browse-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByText(dialogTitle, { exact: true })).toBeVisible();

  const search = modal.getByRole("textbox", { name: /search/i }).or(modal.getByPlaceholder("Search…"));
  await search.fill(value);
  await page.waitForTimeout(800);

  const rows = modal.locator('[data-testid^="grid-row-"]');
  await expect(rows.first()).toBeVisible({ timeout: 10000 });
  const rowTexts = await rows.evaluateAll((elements) =>
    elements.map((element) => (element.textContent || "").replace(/\s+/g, " ").trim())
  );
  const targetIndex = rowTexts.findIndex((text) => text.toLowerCase().startsWith(value.toLowerCase()));
  expect(targetIndex, `Lookup row not found for ${value}. Rows: ${rowTexts.join(" | ")}`).toBeGreaterThanOrEqual(0);
  await rows.nth(targetIndex).click();

  await expect(modal).toBeHidden({ timeout: 10000 });
  await expect(container.locator('input[type="hidden"]')).toHaveValue(value);
}

async function ensureColumnVisible(page: Page, columnKey: string, visible: boolean) {
  await page.getByTestId("grid-toolbar-columns").click();
  const toggle = page.getByTestId(`grid-column-toggle-users-${columnKey}`);
  const header = page.getByTestId(`grid-header-users-${columnKey}`);
  const currentlyVisible = (await header.count()) > 0;
  if (currentlyVisible !== visible) {
    await toggle.click();
    if (visible) await expect(header).toBeVisible();
    else await expect(header).toHaveCount(0);
  }
  await page.getByTestId("grid-toolbar-columns").click();
}

async function openAdriel(page: Page) {
  await reopenUsers(page);
  await selectUser(page, "adriel");
}

test.describe.serial("Users page regressions", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("column picker hides and persists the Company column", async ({ page }) => {
    await gotoUsers(page);
    await ensureColumnVisible(page, "company", true);

    await page.getByTestId("grid-toolbar-columns").click();
    await page.getByTestId("grid-column-toggle-users-company").click();
    await expect(page.getByTestId("grid-header-users-company")).toHaveCount(0);

    await reopenUsers(page);
    await expect(page.getByTestId("grid-header-users-company")).toHaveCount(0);

    await ensureColumnVisible(page, "company", true);
    await reopenUsers(page);
    await expect(page.getByTestId("grid-header-users-company")).toBeVisible();
  });

  test("new user flow clears key fields and shows required validation", async ({ page }) => {
    await gotoUsers(page);
    await selectUser(page, "adriel");
    await page.getByTestId("panel-toolbar-new").click();

    await expect(field(page, "user_id").locator("input").first()).toHaveValue("");
    await expect(field(page, "full_name").locator("input").first()).toHaveValue("");
    await expect(page.getByTestId("panel-toolbar-save")).toBeEnabled();

    await page.getByTestId("panel-toolbar-save").click();
    await expect(field(page, "user_id")).toContainText("required");
    await expect(field(page, "full_name")).toContainText("required");
    await expect(field(page, "email")).toContainText("required");
  });

  test("copy user flow keeps non-key values and clears key field", async ({ page }) => {
    await gotoUsers(page);
    await selectUser(page, "adriel");
    await openDetailsTab(page);

    const originalTitle = await field(page, "title").locator("input").first().inputValue();
    const originalFullName = await field(page, "full_name").locator("input").first().inputValue();

    await page.getByTestId("panel-toolbar-copy").click();

    await expect(field(page, "user_id").locator("input").first()).toHaveValue("");
    await expect(field(page, "full_name").locator("input").first()).toHaveValue(originalFullName);
    await expect(field(page, "title").locator("input").first()).toHaveValue(originalTitle);
    await expect(page.getByTestId("panel-toolbar-save")).toBeEnabled();
  });

  test("can update Adriel title and restore it", async ({ page }) => {
    await gotoUsers(page);
    await selectUser(page, "adriel");
    await openDetailsTab(page);

    const titleInput = field(page, "title").locator("input").first();
    const originalTitle = await titleInput.inputValue();
    const updatedTitle = originalTitle.includes("[PW]") ? originalTitle.replace(" [PW]", "") : `${originalTitle} [PW]`;

    await titleInput.fill(updatedTitle);
    await savePanel(page);

    await openAdriel(page);
    await openDetailsTab(page);
    await expect(field(page, "title").locator("input").first()).toHaveValue(updatedTitle);

    await field(page, "title").locator("input").first().fill(originalTitle);
    await savePanel(page);

    await openAdriel(page);
    await openDetailsTab(page);
    await expect(field(page, "title").locator("input").first()).toHaveValue(originalTitle);
  });

  test("can update Adriel supervisor and restore it", async ({ page }) => {
    await gotoUsers(page);
    await selectUser(page, "adriel");
    await openSettingsTab(page);

    const supervisorInput = field(page, "supervisor_id").locator('input[type="hidden"]');
    const originalSupervisor = await supervisorInput.inputValue();
    const updatedSupervisor = originalSupervisor === "aweinstein" ? "amathieu" : "aweinstein";

    await setLookupValue(page, "supervisor_id", "Select Supervisor", updatedSupervisor);
    await savePanel(page);

    await openAdriel(page);
    await openSettingsTab(page);
    await expect(field(page, "supervisor_id").locator('input[type="hidden"]')).toHaveValue(updatedSupervisor);

    if (updatedSupervisor !== originalSupervisor) {
      await setLookupValue(page, "supervisor_id", "Select Supervisor", originalSupervisor);
      await savePanel(page);
      await openAdriel(page);
      await openSettingsTab(page);
      await expect(field(page, "supervisor_id").locator('input[type="hidden"]')).toHaveValue(originalSupervisor);
    }
  });
});
