import { describe, it, expect } from "vitest";
import { generateFlashcards } from "@/lib/services/openrouter";

describe("openrouter smoke test", () => {
  it("exports generateFlashcards", () => {
    expect(generateFlashcards).toBeDefined();
  });
});
