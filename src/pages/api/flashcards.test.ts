import { describe, it, expect } from "vitest";
import {
  SaveFlashcardsSchema,
  ListQuerySchema,
  UpdateFlashcardSchema,
  DeleteFlashcardSchema,
} from "@/pages/api/flashcards";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("SaveFlashcardsSchema", () => {
  const validCard = { front: "Q", back: "A" };

  it("passes with AI source and valid generation_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "ai",
      generation_id: VALID_UUID,
      flashcards: [validCard],
    });
    expect(result.success).toBe(true);
  });

  it("fails with AI source without generation_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "ai",
      flashcards: [validCard],
    });
    expect(result.success).toBe(false);
  });

  it("passes with manual source without generation_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: [validCard],
    });
    expect(result.success).toBe(true);
  });

  it("fails with manual source with generation_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      generation_id: VALID_UUID,
      flashcards: [validCard],
    });
    expect(result.success).toBe(false);
  });

  it("fails with empty flashcards array", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: [],
    });
    expect(result.success).toBe(false);
  });

  it("passes with 50 flashcards (at max)", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: Array.from({ length: 50 }, () => validCard),
    });
    expect(result.success).toBe(true);
  });

  it("fails with 51 flashcards (above max)", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: Array.from({ length: 51 }, () => validCard),
    });
    expect(result.success).toBe(false);
  });

  it("fails with empty front", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: [{ front: "", back: "A" }],
    });
    expect(result.success).toBe(false);
  });

  it("fails with front exceeding 2000 chars", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      flashcards: [{ front: "a".repeat(2001), back: "A" }],
    });
    expect(result.success).toBe(false);
  });

  it("fails with invalid UUID for generation_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "ai",
      generation_id: "not-a-uuid",
      flashcards: [validCard],
    });
    expect(result.success).toBe(false);
  });

  it("passes with valid collection_id UUID", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      collection_id: VALID_UUID,
      flashcards: [validCard],
    });
    expect(result.success).toBe(true);
  });

  it("passes with null collection_id", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      collection_id: null,
      flashcards: [validCard],
    });
    expect(result.success).toBe(true);
  });

  it("fails with invalid collection_id string", () => {
    const result = SaveFlashcardsSchema.safeParse({
      source: "manual",
      collection_id: "not-a-uuid",
      flashcards: [validCard],
    });
    expect(result.success).toBe(false);
  });

  it("defaults source to 'ai' when omitted", () => {
    const result = SaveFlashcardsSchema.safeParse({
      generation_id: VALID_UUID,
      flashcards: [validCard],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("ai");
    }
  });
});

describe("ListQuerySchema", () => {
  it("passes with defaults when empty", () => {
    const result = ListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("coerces string page to number", () => {
    const result = ListQuerySchema.safeParse({ page: "2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
    }
  });

  it("fails with page 0 (below min)", () => {
    expect(ListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("fails with pageSize 101 (above max)", () => {
    expect(ListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("fails with pageSize 0 (below min)", () => {
    expect(ListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
  });

  it("fails with search exceeding 200 chars", () => {
    expect(ListQuerySchema.safeParse({ search: "a".repeat(201) }).success).toBe(false);
  });

  it("passes with valid search", () => {
    expect(ListQuerySchema.safeParse({ search: "valid" }).success).toBe(true);
  });
});

describe("UpdateFlashcardSchema", () => {
  it("passes with valid id and front", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, front: "Q" }).success).toBe(true);
  });

  it("passes with valid id and back", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, back: "A" }).success).toBe(true);
  });

  it("passes with valid id and collection_id UUID", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, collection_id: VALID_UUID }).success).toBe(true);
  });

  it("passes with valid id and null collection_id", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, collection_id: null }).success).toBe(true);
  });

  it("fails with valid id but no update fields", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID }).success).toBe(false);
  });

  it("fails with invalid UUID for id", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: "not-a-uuid", front: "Q" }).success).toBe(false);
  });

  it("fails with empty front", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, front: "" }).success).toBe(false);
  });

  it("fails with front exceeding 2000 chars", () => {
    expect(UpdateFlashcardSchema.safeParse({ id: VALID_UUID, front: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("DeleteFlashcardSchema", () => {
  it("passes with valid UUID", () => {
    expect(DeleteFlashcardSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it("fails with invalid UUID", () => {
    expect(DeleteFlashcardSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });

  it("fails with missing id", () => {
    expect(DeleteFlashcardSchema.safeParse({}).success).toBe(false);
  });
});
