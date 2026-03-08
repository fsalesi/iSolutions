import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:3001";

const AUTH_COOKIE = {
  name: "isolutions-user",
  value: "frank",
  domain: "localhost",
  path: "/",
  secure: false,
  httpOnly: false,
  sameSite: "Lax" as const,
};

export async function authenticate(context: BrowserContext, userId: string = "frank") {
  await context.addCookies([AUTH_COOKIE]);
  await context.request.put(`${BASE_URL}/api/users/locale`, {
    data: { userId, locale: "en-us" },
  });
}

export function field(page: Page, key: string) {
  return page.getByTestId(`field-${key}`);
}

export function gridRow(page: Page, gridKey: string) {
  return page.locator(`[data-testid^="grid-row-${gridKey}-"]`);
}

export async function expectRequired(locator: Locator) {
  await expect(locator).toContainText(/required|obbligatorio/i);
}

export async function gotoForm(page: Page, formKey: string, readyLocator: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate((nav) => sessionStorage.setItem("isolutions.nav", nav), `form:${formKey}`);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(readyLocator)).toBeVisible({ timeout: 15000 });
}

export async function reopenForm(page: Page, formKey: string, readyLocator: string) {
  await gotoForm(page, formKey, readyLocator);
}

export async function savePanel(page: Page, apiPath: string) {
  const saveButton = page.getByTestId("panel-toolbar-save");
  await expect(saveButton).toBeEnabled();
  const responsePromise = page.waitForResponse((response) => {
    return response.url().includes(apiPath) && ["PUT", "POST"].includes(response.request().method());
  });
  await saveButton.click();
  const response = await responsePromise;
  expect(response.ok(), `Save failed with status ${response.status()}`).toBeTruthy();
  await expect(saveButton).toBeDisabled({ timeout: 10000 });
}

export async function openSidebar(page: Page) {
  const menuButton = page.locator("header button").first();
  await menuButton.click();
  await expect(page.getByText("iSolutions", { exact: true })).toBeVisible({ timeout: 10000 });
}

export async function navigateViaSidebar(page: Page, label: string | RegExp, readyLocator: string) {
  await openSidebar(page);
  await page.getByRole("button", { name: label }).click();
  await expect(page.locator(readyLocator)).toBeVisible({ timeout: 15000 });
}
