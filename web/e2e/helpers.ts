import { expect, type Page } from "@playwright/test";

export const EMAIL = process.env.E2E_EMAIL || "e2e@ekilie.test";
export const PASSWORD = process.env.E2E_PASSWORD || "E2ePass1234!";

export async function login(page: Page) {
  await page.goto("/");
  await page.locator("#identity").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Console", exact: true })).toBeVisible();
}

export async function createCollection(page: Page, name: string) {
  await page.goto("/collections");
  await page.getByLabel("New collection").click();
  await page.locator("#collection-name").fill(name);
  await page.getByRole("button", { name: "Add field" }).click();
  await page.getByPlaceholder("field name").fill("title");
  await page.getByRole("button", { name: "Create collection" }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
}
