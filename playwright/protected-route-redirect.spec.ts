// Risk: test-plan.md #7 — Protected route accessible without login
// Seed: playwright/seed.spec.ts

import { test, expect } from "@playwright/test";

// Clear auth state to simulate unauthenticated user
test.use({ storageState: { cookies: [], origins: [] } });

test("unauthenticated user is redirected from protected route to sign-in", async ({ page }) => {
  // Navigate to a protected route without authentication
  await page.goto("/flashcards");

  // Should be redirected to sign-in page — not stay on /flashcards
  await expect(page).toHaveURL(/\/auth\/signin/);

  // Protected content must NOT be visible — the user never reaches flashcard data
  await expect(page.getByRole("heading", { name: "My Flashcards" })).not.toBeVisible();
});
