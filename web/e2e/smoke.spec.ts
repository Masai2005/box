import { expect, test } from "@playwright/test";
import { createCollection, login } from "./helpers";

test("login and command palette", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.keyboard.press("Control+k");
  const search = page.getByRole("textbox", { name: "Search pages, collections, actions and records" });
  await expect(search).toBeVisible();
  await search.fill("schema");
  await page.getByRole("option", { name: /Schema \/ ERD/ }).click();
  await expect(page.getByRole("heading", { name: "Schema" })).toBeVisible();
});

test("collection records, inline edit, filter, saved view and mobile cards", async ({ page }) => {
  await login(page);
  const name = `e2e_posts_${Date.now()}`;
  await createCollection(page, name);

  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.getByRole("button", { name: "New record" }).first().click();
  await page.locator("#title").fill("Hello E2E");
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit title inline" })).toContainText("Hello E2E");

  await page.getByRole("button", { name: "Edit title inline" }).dblclick();
  const inline = page.getByRole("textbox", { name: "Edit title" });
  await inline.fill("Hello inline");
  await inline.press("Enter");
  await expect(page.getByRole("button", { name: "Edit title inline" })).toContainText("Hello inline");

  await page.getByRole("textbox", { name: "Filter records" }).fill('title ~ "inline"');
  await expect(page.getByRole("button", { name: "Edit title inline" })).toContainText("Hello inline");
  await expect(page).toHaveURL(/filter=title/);

  page.once("dialog", (dialog) => dialog.accept("Inline view"));
  await page.getByRole("button", { name: "Save view" }).click();
  await expect(page).toHaveURL(/view=Inline/);
  await expect(page.getByRole("combobox", { name: "Saved views" })).toHaveValue("Inline view");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
});

test("global record search finds a record", async ({ page }) => {
  await login(page);
  const name = `e2e_search_${Date.now()}`;
  await createCollection(page, name);
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.getByRole("button", { name: "New record" }).first().click();
  await page.locator("#title").fill("Searchable needle");
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit title inline" })).toContainText("Searchable needle");

  await page.keyboard.press("Control+k");
  await page.getByRole("textbox", { name: "Search pages, collections, actions and records" }).fill("needle");
  await expect(page.getByRole("option", { name: /Searchable needle/ })).toBeVisible({ timeout: 10_000 });
});

test("unsaved settings guard", async ({ page }) => {
  await login(page);
  await page.goto("/settings");
  const appName = page.locator("#appName");
  await expect(appName).toBeVisible();
  const original = await appName.inputValue();
  await appName.fill(`${original} edited`);

  let prompted = false;
  page.once("dialog", async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Collections" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  expect(prompted).toBe(true);
  await appName.fill(original);
});

test("create, run and delete a scheduled HTTP request", async ({ page }) => {
  await login(page);
  await page.goto("/settings/crons");
  await expect(page.getByRole("heading", { name: "Crons" })).toBeVisible();
  await expect(page.getByText("Scheduled requests", { exact: true })).toBeVisible();

  const name = `Cron smoke ${Date.now()}`;
  await page.getByRole("button", { name: "New request" }).first().click();
  await page.locator("#request-name").fill(name);
  await page.locator("#request-schedule").fill("*/5 * * * *");
  await page.locator("#request-method").selectOption("GET");
  await page.locator("#request-url").fill(new URL("/api/health", page.url()).toString());
  await page.getByRole("button", { name: "Create request" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: `Run ${name} now` }).click();
  await expect(row.getByText("HTTP 200")).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete ${name}` }).click();
  await expect(page.getByRole("button", { name: `Run ${name} now` })).toHaveCount(0);
});

test("docs, observability, status, audit, auth and schema pages", async ({ page }) => {
  await login(page);

  const pages = [
    ["/api-docs", "API docs"],
    ["/observability", "Observability"],
    ["/status", "Status"],
    ["/audit", "Audit log"],
    ["/auth", "Auth"],
    ["/schema", "Schema"],
  ] as const;

  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await page.goto("/schema");
  await expect(page.getByText("Relation graph")).toBeVisible();
  await page.goto("/observability");
  await expect(page.getByText("Requests", { exact: true })).toBeVisible();
  await page.goto("/api-docs");
  await expect(page.getByText("Authentication", { exact: true })).toBeVisible();
});

test("auth collection settings expose token durations and save safely", async ({ page }) => {
  await login(page);
  await page.goto("/collections?collection=users");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Auth options" }).click();
  await expect(page.getByText("Auth token duration (seconds)")).toBeVisible();
  await expect(page.getByText("OTP duration (seconds)")).toBeVisible();
  await page.getByRole("button", { name: "Save collection" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("record editor autosaves an existing record", async ({ page }) => {
  await login(page);
  const name = `e2e_autosave_${Date.now()}`;
  await createCollection(page, name);
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.getByRole("button", { name: "New record" }).first().click();
  await page.locator("#title").fill("Before autosave");
  await page.getByRole("button", { name: "Create record" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Edit record" }).first().click();
  await page.getByLabel(/Autosave changes/).check();
  await page.locator("#title").fill("After autosave");
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Edit title inline" })).toContainText("After autosave");
});
