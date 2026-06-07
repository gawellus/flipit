import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createFlashcards, listFlashcards, updateFlashcard, deleteFlashcard } from "@/lib/services/flashcards";
import { NotFoundError } from "@/lib/errors";

interface MockResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

function createMockSupabase(result: MockResult = { data: null, error: null }) {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["from", "insert", "select", "eq", "order", "range", "or", "update", "delete", "single"];
  for (const method of methods) {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  }
  chainable.then = vi.fn().mockImplementation((resolve: (v: MockResult) => void) => {
    resolve(result);
  });
  return chainable as unknown as SupabaseClient;
}

describe("createFlashcards", () => {
  it("returns empty array for empty input without calling supabase", async () => {
    const supabase = createMockSupabase();
    const result = await createFlashcards(supabase, "user-1", []);
    expect(result).toEqual([]);
    expect((supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).from).not.toHaveBeenCalled();
  });

  it("throws on supabase insert error", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "insert failed" } });
    const cards = [{ front: "Q", back: "A", source: "manual" as const }];
    await expect(createFlashcards(supabase, "user-1", cards)).rejects.toThrow(
      "Failed to insert flashcards: insert failed",
    );
  });

  it("returns inserted data on success", async () => {
    const inserted = [{ id: "1", front: "Q", back: "A" }];
    const supabase = createMockSupabase({ data: inserted, error: null });
    const cards = [{ front: "Q", back: "A", source: "manual" as const, generation_id: "gen-1" }];
    const result = await createFlashcards(supabase, "user-1", cards);
    const mock = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(mock.insert).toHaveBeenCalledWith([
      { user_id: "user-1", front: "Q", back: "A", source: "manual", generation_id: "gen-1" },
    ]);
    expect(result).toEqual(inserted);
  });
});

describe("listFlashcards", () => {
  it("does not call .or() when no search term is provided", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10 });
    const mock = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;
    expect(mock.from).toHaveBeenCalled();
    expect(mock.or).not.toHaveBeenCalled();
  });

  it("escapes % in search term", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10, search: "100%" });
    const orMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).or;
    expect(orMock).toHaveBeenCalledWith("front.ilike.%100\\%%,back.ilike.%100\\%%");
  });

  it("escapes _ in search term", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10, search: "a_b" });
    const orMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).or;
    expect(orMock).toHaveBeenCalledWith("front.ilike.%a\\_b%,back.ilike.%a\\_b%");
  });

  it("escapes , in search term", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10, search: "a,b" });
    const orMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).or;
    expect(orMock).toHaveBeenCalledWith("front.ilike.%a\\,b%,back.ilike.%a\\,b%");
  });

  it("escapes . in search term", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10, search: "a.b" });
    const orMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).or;
    expect(orMock).toHaveBeenCalledWith("front.ilike.%a\\.b%,back.ilike.%a\\.b%");
  });

  it("computes range(0, 9) for page 1, pageSize 10", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10 });
    const rangeMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).range;
    expect(rangeMock).toHaveBeenCalledWith(0, 9);
  });

  it("computes range(10, 19) for page 2, pageSize 10", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 0 });
    await listFlashcards(supabase, "user-1", { page: 2, pageSize: 10 });
    const rangeMock = (supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).range;
    expect(rangeMock).toHaveBeenCalledWith(10, 19);
  });

  it("throws on supabase error", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "query failed" } });
    await expect(listFlashcards(supabase, "user-1", { page: 1, pageSize: 10 })).rejects.toThrow(
      "Failed to list flashcards: query failed",
    );
  });

  it("defaults totalCount to 0 when count is null", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: null });
    const result = await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10 });
    expect(result.totalCount).toBe(0);
  });

  it("computes totalPages correctly", async () => {
    const supabase = createMockSupabase({ data: [], error: null, count: 25 });
    const result = await listFlashcards(supabase, "user-1", { page: 1, pageSize: 10 });
    expect(result.totalPages).toBe(3);
  });
});

describe("updateFlashcard", () => {
  it("returns updated flashcard on success", async () => {
    const updated = { id: "1", front: "Q2", back: "A2" };
    const supabase = createMockSupabase({ data: updated, error: null });
    const result = await updateFlashcard(supabase, "user-1", "1", { front: "Q2" });
    expect(result).toEqual(updated);
  });

  it("throws NotFoundError on PGRST116", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "not found", code: "PGRST116" } });
    await expect(updateFlashcard(supabase, "user-1", "1", { front: "Q2" })).rejects.toThrow("Flashcard not found");
    await expect(updateFlashcard(supabase, "user-1", "1", { front: "Q2" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws generic error on other supabase errors", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "db error" } });
    await expect(updateFlashcard(supabase, "user-1", "1", { front: "Q2" })).rejects.toThrow(
      "Failed to update flashcard: db error",
    );
  });
});

describe("deleteFlashcard", () => {
  it("returns void on success", async () => {
    const supabase = createMockSupabase({ data: { id: "1" }, error: null });
    await expect(deleteFlashcard(supabase, "user-1", "1")).resolves.toBeUndefined();
  });

  it("throws NotFoundError on PGRST116", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "not found", code: "PGRST116" } });
    await expect(deleteFlashcard(supabase, "user-1", "1")).rejects.toThrow("Flashcard not found");
    await expect(deleteFlashcard(supabase, "user-1", "1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws generic error on other supabase errors", async () => {
    const supabase = createMockSupabase({ data: null, error: { message: "db error" } });
    await expect(deleteFlashcard(supabase, "user-1", "1")).rejects.toThrow("Failed to delete flashcard: db error");
  });
});
