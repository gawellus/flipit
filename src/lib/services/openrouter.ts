import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from "astro:env/server";
import type { FlashcardProposal } from "@/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are a flashcard generator. Given study text, create flashcards that help a student learn the key concepts.

Rules:
- Each flashcard has a "front" (question or prompt) and a "back" (answer or explanation).
- Create one card per distinct concept — do not repeat or overlap.
- Keep the front concise (ideally one sentence or question).
- Keep the back focused and clear (1-3 sentences).
- Return a JSON object with a single key "flashcards" containing an array of objects with "front" and "back" keys.
- No markdown, no code fences, no extra text — just the raw JSON object.

Example output:
{"flashcards":[{"front":"What is photosynthesis?","back":"The process by which green plants convert sunlight, water, and CO2 into glucose and oxygen."}]}`;

export async function generateFlashcards(sourceText: string): Promise<FlashcardProposal[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: sourceText },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response");
  }

  try {
    return parseFlashcards(content);
  } catch (e) {
    throw new Error(`${(e as Error).message} — raw LLM response: ${content.slice(0, 500)}`);
  }
}

export function parseFlashcards(raw: string): FlashcardProposal[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse LLM response as JSON");
  }

  // Handle both direct array and { flashcards: [...] } wrapper
  const arr = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        "flashcards" in parsed &&
        Array.isArray((parsed as Record<string, unknown>).flashcards)
      ? (parsed as Record<string, unknown>).flashcards
      : null;

  if (!arr) {
    throw new Error("LLM response is not a flashcard array");
  }

  const proposals: FlashcardProposal[] = [];

  for (const item of arr as unknown[]) {
    if (
      typeof item === "object" &&
      item !== null &&
      "front" in item &&
      "back" in item &&
      typeof (item as Record<string, unknown>).front === "string" &&
      typeof (item as Record<string, unknown>).back === "string"
    ) {
      const front = (item as Record<string, string>).front;
      const back = (item as Record<string, string>).back;
      if (front.trim().length < 1 || back.trim().length < 1 || front.length > 2000 || back.length > 2000) {
        continue;
      }
      proposals.push({ front, back });
    }
  }

  if (proposals.length === 0) {
    throw new Error("LLM response contained no valid flashcard proposals");
  }

  return proposals;
}
