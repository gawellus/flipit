import type { APIRoute } from "astro";
import { z } from "zod";
import { generateFlashcards } from "@/lib/services/openrouter";

export const GenerateRequestSchema = z.object({
  source_text: z
    .string()
    .min(1, "Source text cannot be empty")
    .max(10000, "Source text cannot exceed 10,000 characters"),
});

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = GenerateRequestSchema.safeParse(body);
  if (!validation.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        issues: validation.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const flashcards = await generateFlashcards(validation.data.source_text);
    const generationId = crypto.randomUUID();

    return new Response(JSON.stringify({ generation_id: generationId, flashcards }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Flashcard generation failed. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
