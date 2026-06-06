import { describe, it, expect } from "vitest";
import { ReviewSchema } from "@/pages/api/study/review";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("ReviewSchema", () => {
  it("passes with rating 1 (Again, lower bound)", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: 1 }).success).toBe(true);
  });

  it("passes with rating 4 (Easy, upper bound)", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: 4 }).success).toBe(true);
  });

  it("fails with rating 0 (below min)", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: 0 }).success).toBe(false);
  });

  it("fails with rating 5 (above max)", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: 5 }).success).toBe(false);
  });

  it("fails with non-integer rating", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: 2.5 }).success).toBe(false);
  });

  it("fails with string rating (no coercion)", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: VALID_UUID, rating: "3" }).success).toBe(false);
  });

  it("fails with invalid UUID for flashcard_id", () => {
    expect(ReviewSchema.safeParse({ flashcard_id: "not-a-uuid", rating: 2 }).success).toBe(false);
  });

  it("fails with missing fields", () => {
    expect(ReviewSchema.safeParse({}).success).toBe(false);
  });
});
