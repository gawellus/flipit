import { describe, it, expect } from "vitest";
import { ParamsSchema } from "@/pages/api/study/[id]";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("ParamsSchema", () => {
  it("passes with valid UUID", () => {
    expect(ParamsSchema.safeParse({ id: VALID_UUID }).success).toBe(true);
  });

  it("fails with invalid UUID", () => {
    expect(ParamsSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
  });

  it("fails with missing id", () => {
    expect(ParamsSchema.safeParse({}).success).toBe(false);
  });
});
