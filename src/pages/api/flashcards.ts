import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createFlashcards } from "@/lib/services/flashcards";

const SaveFlashcardsSchema = z.object({
  generation_id: z.uuid("generation_id must be a valid UUID"),
  flashcards: z
    .array(
      z.object({
        front: z.string().min(1, "front cannot be empty").max(2000, "front cannot exceed 2000 characters"),
        back: z.string().min(1, "back cannot be empty").max(2000, "back cannot exceed 2000 characters"),
      }),
    )
    .min(1, "flashcards array cannot be empty")
    .max(50, "flashcards array cannot exceed 50 items"),
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

  const validation = SaveFlashcardsSchema.safeParse(body);
  if (!validation.success) {
    return new Response(
      JSON.stringify({
        error: "Validation failed",
        issues: validation.error.issues.map((i) => i.message),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const cards = validation.data.flashcards.map((f) => ({
      front: f.front,
      back: f.back,
      source: "ai" as const,
      generation_id: validation.data.generation_id,
    }));

    const saved = await createFlashcards(supabase, context.locals.user.id, cards);

    return new Response(JSON.stringify({ saved_count: saved.length }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save flashcards";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
