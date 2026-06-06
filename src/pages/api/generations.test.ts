import { describe, it, expect } from "vitest";
import { GenerateRequestSchema } from "@/pages/api/generations";

describe("GenerateRequestSchema", () => {
  it("passes with valid source_text", () => {
    expect(GenerateRequestSchema.safeParse({ source_text: "a" }).success).toBe(true);
  });

  it("fails with empty source_text", () => {
    expect(GenerateRequestSchema.safeParse({ source_text: "" }).success).toBe(false);
  });

  it("passes at max length (10000)", () => {
    expect(GenerateRequestSchema.safeParse({ source_text: "a".repeat(10000) }).success).toBe(true);
  });

  it("fails above max length (10001)", () => {
    expect(GenerateRequestSchema.safeParse({ source_text: "a".repeat(10001) }).success).toBe(false);
  });

  it("fails with missing source_text", () => {
    expect(GenerateRequestSchema.safeParse({}).success).toBe(false);
  });

  it("fails with wrong type", () => {
    expect(GenerateRequestSchema.safeParse({ source_text: 123 }).success).toBe(false);
  });
});
