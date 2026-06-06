import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const envMocks = vi.hoisted(() => ({
  OPENROUTER_API_KEY: "test-openrouter-key",
  OPENROUTER_MODEL: "test/model",
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_KEY: "test-supabase-key",
}));

vi.mock("astro:env/server", () => envMocks);

import { parseFlashcards, generateFlashcards } from "@/lib/services/openrouter";

describe("parseFlashcards", () => {
  describe("happy paths", () => {
    it("parses valid wrapper object", () => {
      const raw = JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] });
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("parses valid direct array", () => {
      const raw = JSON.stringify([{ front: "Q", back: "A" }]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("strips extra fields from items", () => {
      const raw = JSON.stringify({ flashcards: [{ front: "Q", back: "A", hint: "H" }] });
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("returns only valid items from a mix of valid and invalid", () => {
      const raw = JSON.stringify({
        flashcards: [
          { front: "Q1", back: "A1" },
          { question: "Q2", answer: "A2" },
          { front: "Q3", back: "A3" },
        ],
      });
      expect(parseFlashcards(raw)).toEqual([
        { front: "Q1", back: "A1" },
        { front: "Q3", back: "A3" },
      ]);
    });
  });

  describe("error paths", () => {
    it("throws on invalid JSON", () => {
      expect(() => parseFlashcards("not json")).toThrow("Failed to parse LLM response as JSON");
    });

    it("throws on truncated JSON", () => {
      expect(() => parseFlashcards('{"flashcards":[{"front":"Q"')).toThrow("Failed to parse LLM response as JSON");
    });

    it("throws on wrong wrapper key", () => {
      const raw = JSON.stringify({ cards: [{ front: "Q", back: "A" }] });
      expect(() => parseFlashcards(raw)).toThrow("LLM response is not a flashcard array");
    });

    it("throws on empty array", () => {
      const raw = JSON.stringify({ flashcards: [] });
      expect(() => parseFlashcards(raw)).toThrow("LLM response contained no valid flashcard proposals");
    });

    it("throws when all items are invalid", () => {
      const raw = JSON.stringify({ flashcards: [{ question: "Q", answer: "A" }] });
      expect(() => parseFlashcards(raw)).toThrow("LLM response contained no valid flashcard proposals");
    });

    it("throws on null", () => {
      expect(() => parseFlashcards("null")).toThrow("LLM response is not a flashcard array");
    });

    it("throws on plain string value", () => {
      expect(() => parseFlashcards('"just a string"')).toThrow("LLM response is not a flashcard array");
    });

    it("throws on number value", () => {
      expect(() => parseFlashcards("42")).toThrow("LLM response is not a flashcard array");
    });
  });

  describe("silent filtering", () => {
    it("filters items with wrong keys", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { question: "Q", answer: "A" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with non-string front", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: 123, back: "A" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with empty front", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: "", back: "A" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with whitespace-only front", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: "   ", back: "A" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with front exceeding 2000 chars", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: "x".repeat(2001), back: "A" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with empty back", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: "Q2", back: "" },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });

    it("filters items with back exceeding 2000 chars", () => {
      const raw = JSON.stringify([
        { front: "Q", back: "A" },
        { front: "Q2", back: "x".repeat(2001) },
      ]);
      expect(parseFlashcards(raw)).toEqual([{ front: "Q", back: "A" }]);
    });
  });
});

describe("generateFlashcards", () => {
  beforeEach(() => {
    envMocks.OPENROUTER_API_KEY = "test-openrouter-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchResponse(body: object, status = 200) {
    vi.mocked(fetch).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
  }

  it("throws when API key is missing", async () => {
    envMocks.OPENROUTER_API_KEY = "";
    await expect(generateFlashcards("test")).rejects.toThrow("not configured");
  });

  it("throws on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("rate limited"),
    } as Response);

    await expect(generateFlashcards("test")).rejects.toThrow("OpenRouter API error (429): rate limited");
  });

  it("throws on empty choices array", async () => {
    mockFetchResponse({ choices: [] });
    await expect(generateFlashcards("test")).rejects.toThrow("empty response");
  });

  it("throws on null message content", async () => {
    mockFetchResponse({ choices: [{ message: { content: null } }] });
    await expect(generateFlashcards("test")).rejects.toThrow("empty response");
  });

  it("returns parsed flashcards on valid response", async () => {
    const flashcardsJson = JSON.stringify({ flashcards: [{ front: "Q", back: "A" }] });
    mockFetchResponse({
      choices: [{ message: { content: flashcardsJson } }],
    });

    const result = await generateFlashcards("test");
    expect(result).toEqual([{ front: "Q", back: "A" }]);
  });
});
