// Risk: test-plan.md #4 — Flashcard CRUD: edit doesn't persist after page reload
// Seed: playwright/seed.spec.ts

import { test, expect } from "@playwright/test";

test("edited flashcard front text persists after page reload", async ({ page }) => {
  const uid = Date.now();
  const originalFront = `E2E Front ${uid}`;
  const originalBack = `E2E Back ${uid}`;
  const editedFront = `Edited Front ${uid}`;

  await page.goto("/flashcards");

  // Create a flashcard with unique text
  await page.getByRole("button", { name: "Add flashcard" }).click();
  await page.getByPlaceholder("Question or term...").fill(originalFront);
  await page.getByPlaceholder("Answer or definition...").fill(originalBack);
  await page.getByRole("button", { name: "Save" }).click();

  // Wait for card to appear in the list (create form closes, list refreshes)
  await expect(page.getByText(originalFront)).toBeVisible();

  // Scope to the card containing our unique text
  const card = page.locator('[data-slot="card"]').filter({ hasText: originalFront });

  // Edit the card's front text
  await card.getByRole("button", { name: "Edit" }).click();

  // In edit mode, plain text becomes textarea values — re-scope by Cancel button
  const editingCard = page.locator('[data-slot="card"]').filter({ has: page.getByRole("button", { name: "Cancel" }) });
  const frontTextbox = editingCard.getByRole("textbox").first();
  await frontTextbox.clear();
  await frontTextbox.fill(editedFront);
  await editingCard.getByRole("button", { name: "Save" }).click();

  // Wait for edit mode to exit — edited text appears as plain text
  await expect(page.getByText(editedFront)).toBeVisible();

  // Reload and verify persistence — the core risk assertion
  await page.reload();
  await expect(page.getByText(editedFront)).toBeVisible();
  await expect(page.getByText(originalFront)).not.toBeVisible();

  // Cleanup
  const editedCard = page.locator('[data-slot="card"]').filter({ hasText: editedFront });
  await editedCard.getByRole("button", { name: "Delete flashcard" }).click();
  await editedCard.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(editedFront)).not.toBeVisible();
});
