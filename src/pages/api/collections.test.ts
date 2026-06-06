import { describe, it, expect } from "vitest";
import { CreateCollectionSchema, DeleteCollectionSchema } from "@/pages/api/collections";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("CreateCollectionSchema", () => {
  it("passes with valid name", () => {
    expect(CreateCollectionSchema.safeParse({ name: "Valid" }).success).toBe(true);
  });

  it("fails with empty name", () => {
    expect(CreateCollectionSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("fails with whitespace-only name", () => {
    expect(CreateCollectionSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("fails with name exceeding 200 chars", () => {
    expect(CreateCollectionSchema.safeParse({ name: "a".repeat(201) }).success).toBe(false);
  });

  it("passes at max length (200)", () => {
    expect(CreateCollectionSchema.safeParse({ name: "a".repeat(200) }).success).toBe(true);
  });

  it("fails with missing name", () => {
    expect(CreateCollectionSchema.safeParse({}).success).toBe(false);
  });
});

describe("DeleteCollectionSchema", () => {
  it("passes with valid UUID", () => {
    expect(DeleteCollectionSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it("fails with invalid UUID", () => {
    expect(DeleteCollectionSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });

  it("fails with missing id", () => {
    expect(DeleteCollectionSchema.safeParse({}).success).toBe(false);
  });
});
