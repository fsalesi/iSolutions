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
  await page.waitForTimeout(1000);
  await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("grid-toolbar-columns")).toBeVisible();
  await expect(page.getByText("adriel", { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

async function selectUser(page: Page, userId: string) {
  await page.getByText(userId, { exact: true }).first().click();
  await expect(page.getByTestId("field-user_id").locator('input[value="' + userId + '"]')).toBeVisible();
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
  const search = modal.getByTestId("grid-search-grid");
  await search.fill(value);
  await page.waitForTimeout(800);
  await modal.locator('[data-testid^="grid-row-"]').filter({ has: modal.getByText(value, { exact: true }) }).first().click();
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

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("grid-header-users-company")).toHaveCount(0);

    await ensureColumnVisible(page, "company", true);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("grid-header-users-company")).toBeVisible();
  });

  test("can update Adriel title and supervisor, then restore both", async ({ page }) => {
    test.setTimeout(60000);
    await gotoUsers(page);
    await selectUser(page, "adriel");
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(field(page, "title")).toBeVisible();

    const titleInput = field(page, "title").locator('input').first();
    const originalTitle = await titleInput.inputValue();
    const updatedTitle = originalTitle.includes("[PW]") ? originalTitle.replace(" [PW]", "") : `${originalTitle} [PW]`;

    await openSettingsTab(page);
    const supervisorInput = field(page, "supervisor_id").locator('input[type="hidden"]');
    const originalSupervisor = await supervisorInput.inputValue();
    const updatedSupervisor = originalSupervisor === "aweinstein" ? "amathieu" : "aweinstein";

    try {
      await page.getByRole("button", { name: "Details", exact: true }).click();
      await expect(field(page, "title")).toBeVisible();
      await titleInput.fill(updatedTitle);
      await savePanel(page);

      await page.reload({ waitUntil: "networkidle" });
      await selectUser(page, "adriel");
      await expect(field(page, "title").locator('input').first()).toHaveValue(updatedTitle);

      await openSettingsTab(page);
      await setLookupValue(page, "supervisor_id", "Select Supervisor", updatedSupervisor);
      await savePanel(page);

      await page.reload({ waitUntil: "networkidle" });
      await selectUser(page, "adriel");
      await expect(field(page, "title").locator('input').first()).toHaveValue(updatedTitle);
      await openSettingsTab(page);
      await expect(field(page, "supervisor_id").locator('input[type="hidden"]')).toHaveValue(updatedSupervisor);
    } finally {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
      await page.reload({ waitUntil: "networkidle" });
      await selectUser(page, "adriel");
      await page.getByRole("button", { name: "Details", exact: true }).click();
      await field(page, "title").locator('input').first().fill(originalTitle);
      await openSettingsTab(page);
      if ((await field(page, "supervisor_id").locator('input[type="hidden"]').inputValue()) !== originalSupervisor) {
        await setLookupValue(page, "supervisor_id", "Select Supervisor", originalSupervisor);
      }
      await savePanel(page);
    }
  });
});
