// Risk: test-plan.md #6 — Collection due counts are wrong on study landing page
// Seed: playwright/seed.spec.ts

import { test, expect } from "@playwright/test";

test("collection due count reflects assigned card with due SR state", async ({ page }) => {
  const uid = Date.now();
  const collectionName = `E2E Collection ${uid}`;
  const cardFront = `E2E Due Front ${uid}`;
  const cardBack = `E2E Due Back ${uid}`;

  // Create a collection on the study page
  await page.goto("/study");
  await page.getByRole("button", { name: "Create Collection" }).click();
  await page.getByRole("textbox", { name: "Collection name" }).fill(collectionName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: collectionName })).toBeVisible();

  // Verify initial counts are zero
  const collectionCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: collectionName }) });
  await expect(collectionCard.getByText("0 cards")).toBeVisible();
  await expect(collectionCard.getByText("0 due")).toBeVisible();

  // Create a flashcard (auto SR state makes it immediately due)
  await page.goto("/flashcards");
  await page.getByRole("button", { name: "Add flashcard" }).click();
  await page.getByPlaceholder("Question or term...").fill(cardFront);
  await page.getByPlaceholder("Answer or definition...").fill(cardBack);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(cardFront)).toBeVisible();

  // Assign the card to the collection via the dropdown
  const flashcardCard = page.locator('[data-slot="card"]').filter({ hasText: cardFront });
  const patchResponse = page.waitForResponse(
    (res) => res.url().includes("/api/flashcards") && res.request().method() === "PATCH",
  );
  await flashcardCard.getByRole("combobox").selectOption({ label: collectionName });
  await patchResponse;

  // Navigate to study page and verify due count updated
  await page.goto("/study");
  const updatedCard = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: collectionName }) });
  await expect(updatedCard.getByText("1 card")).toBeVisible();
  await expect(updatedCard.getByText("1 due")).toBeVisible();

  // Cleanup: delete the flashcard, then delete the collection
  await page.goto("/flashcards");
  const cardToDelete = page.locator('[data-slot="card"]').filter({ hasText: cardFront });
  await cardToDelete.getByRole("button", { name: "Delete flashcard" }).click();
  await cardToDelete.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(cardFront)).not.toBeVisible();

  await page.goto("/study");
  const collectionToDelete = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: collectionName }) });
  await collectionToDelete.getByRole("button", { name: "Delete collection" }).click();
  await collectionToDelete.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: collectionName })).not.toBeVisible();
});
