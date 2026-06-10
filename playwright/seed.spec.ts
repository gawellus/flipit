import { test, expect } from "@playwright/test";

test("created deck persists after page reload", async ({ page }) => {
  const deckName = `Test Deck ${Date.now()}`;
  await page.goto("/study");

  await page.getByRole("button", { name: "Create Collection" }).click();
  await page.getByRole("textbox", { name: "Collection name" }).fill(deckName);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("heading", { name: deckName })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: deckName })).toBeVisible();

  // Cleanup
  const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: deckName }) });
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: deckName })).not.toBeVisible();
});
