import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { authenticate } from "./test-helpers";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3001";

type TempUser = {
  userId: string;
  fullName: string;
  email: string;
};

function makeTempUser(): TempUser {
  const stamp = Date.now().toString(36).slice(-6);
  const userId = `pw_${stamp}`;
  return {
    userId,
    fullName: `Playwright ${stamp}`,
    email: `${userId}@example.com`,
  };
}

async function apiFindUser(request: APIRequestContext, userId: string) {
  const res = await request.get(`${BASE_URL}/api/users?table=users&search=${encodeURIComponent(userId)}&limit=20`);
  expect(res.ok(), `User lookup failed with status ${res.status()}`).toBeTruthy();
  const data = await res.json();
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.find((row: Record<string, unknown>) => String(row.user_id ?? "").toLowerCase() === userId.toLowerCase()) ?? null;
}

async function apiDeleteUser(request: APIRequestContext, oid: string) {
  const res = await request.delete(`${BASE_URL}/api/users?table=users&oid=${encodeURIComponent(oid)}`);
  expect(res.ok(), `Delete failed with status ${res.status()}`).toBeTruthy();
}

async function expectLoginStatus(request: APIRequestContext, userId: string, password: string, expectedStatus: number) {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { userId, password },
  });
  expect(res.status(), `Unexpected login status for ${userId}`).toBe(expectedStatus);
  return res;
}

async function setCheckboxValue(page: Page, key: string, checked: boolean) {
  const toggle = field(page, key).getByRole("switch");
  await expect(toggle).toBeVisible();
  const current = await toggle.getAttribute("aria-checked");
  const isChecked = current === "true";
  if (isChecked !== checked) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", checked ? "true" : "false");
}

async function setPreloadedLookupValue(page: Page, key: string, value: string) {
  const container = field(page, key);
  const input = container.locator('input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(300);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(container.locator('input[type="hidden"]')).toHaveValue(value);
}

async function createUser(page: Page, user: TempUser) {
  await gotoUsers(page);
  await page.getByTestId("panel-toolbar-new").click();
  await field(page, "user_id").locator("input").first().fill(user.userId);
  await field(page, "full_name").locator("input").first().fill(user.fullName);
  await field(page, "email").locator("input").first().fill(user.email);
  await setCheckboxValue(page, "is_active", true);
  await openSettingsTab(page);
  await setPreloadedLookupValue(page, "locale", "en-us");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await savePanel(page);
}

async function deleteSelectedUser(page: Page) {
  const responsePromise = page.waitForResponse((response) => {
    return response.url().includes("/api/users?") && response.request().method() === "DELETE";
  });
  await page.getByTestId("panel-toolbar-delete").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), `Delete failed with status ${response.status()}`).toBeTruthy();
}

async function filterUsers(page: Page, value: string) {
  const search = page.getByTestId("grid-search-users");
  await expect(search).toBeVisible({ timeout: 15000 });
  await search.fill(value);
  await expect(page.getByText(value, { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

async function gotoUsers(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
  await page.reload({ waitUntil: "networkidle" });
  await filterUsers(page, "adriel");
}

async function reopenUsers(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate(() => sessionStorage.setItem("isolutions.nav", "form:users"));
  await page.reload({ waitUntil: "networkidle" });
  await filterUsers(page, "adriel");
}

async function selectUser(page: Page, userId: string) {
  await filterUsers(page, userId);
  await page.getByText(userId, { exact: true }).first().click();
  await expect(page.getByTestId("field-user_id").locator(`input[value="${userId}"]`)).toBeVisible({ timeout: 15000 });
}

function field(page: Page, key: string) {
  return page.getByTestId(`field-${key}`);
}

function expectRequired(locator: ReturnType<typeof field>) {
  return expect(locator).toContainText(/required|obbligatorio/i);
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

  const search = modal.getByRole("textbox", { name: /search/i }).or(modal.getByPlaceholder(/Search(?:\.|…)+/i));
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
    await authenticate(context, "frank");
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
    await expectRequired(field(page, "user_id"));
    await expectRequired(field(page, "full_name"));
    await expectRequired(field(page, "email"));
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
  test("can create a temp user, log in, and delete it", async ({ page, context }) => {
    const user = makeTempUser();
    let createdOid = "";

    try {
      await createUser(page, user);

      const created = await apiFindUser(context.request, user.userId);
      expect(created, `Created user ${user.userId} was not found via API`).toBeTruthy();
      createdOid = String(created?.oid ?? "");

      const loginOk = await expectLoginStatus(context.request, user.userId, "", 200);
      const loginPayload = await loginOk.json();
      expect(loginPayload.userId).toBe(user.userId);

      await reopenUsers(page);
      await selectUser(page, user.userId);
      await deleteSelectedUser(page);

      const deleted = await apiFindUser(context.request, user.userId);
      expect(deleted).toBeNull();
      createdOid = "";
    } finally {
      if (createdOid) {
        const existing = await apiFindUser(context.request, user.userId);
        if (existing?.oid) await apiDeleteUser(context.request, String(existing.oid));
      }
    }
  });

  test("can deactivate a temp user and block login", async ({ page, context }) => {
    const user = makeTempUser();
    let createdOid = "";

    try {
      await createUser(page, user);

      const created = await apiFindUser(context.request, user.userId);
      expect(created, `Created user ${user.userId} was not found via API`).toBeTruthy();
      createdOid = String(created?.oid ?? "");

      await expectLoginStatus(context.request, user.userId, "", 200);

      await reopenUsers(page);
      await selectUser(page, user.userId);
      await setCheckboxValue(page, "is_active", false);
      await savePanel(page);

      await expectLoginStatus(context.request, user.userId, "", 403);
    } finally {
      if (createdOid) {
        const existing = await apiFindUser(context.request, user.userId);
        if (existing?.oid) await apiDeleteUser(context.request, String(existing.oid));
      }
    }
  });

});
