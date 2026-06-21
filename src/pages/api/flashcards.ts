import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { createFlashcards, listFlashcards, updateFlashcard, deleteFlashcard } from "@/lib/services/flashcards";
import { NotFoundError } from "@/lib/errors";

export const SaveFlashcardsSchema = z
  .object({
    generation_id: z.uuid("generation_id must be a valid UUID").optional(),
    collection_id: z.uuid("collection_id must be a valid UUID").nullable().optional(),
    source: z.enum(["ai", "manual"]).default("ai"),
    flashcards: z
      .array(
        z.object({
          front: z.string().min(1, "front cannot be empty").max(2000, "front cannot exceed 2000 characters"),
          back: z.string().min(1, "back cannot be empty").max(2000, "back cannot exceed 2000 characters"),
        }),
      )
      .min(1, "flashcards array cannot be empty")
      .max(50, "flashcards array cannot exceed 50 items"),
  })
  .refine(
    (data) => {
      if (data.source === "ai") return data.generation_id != null;
      return data.generation_id == null;
    },
    { message: "generation_id is required for ai source and must be absent for manual source" },
  );

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
});

export const UpdateFlashcardSchema = z
  .object({
    id: z.uuid("id must be a valid UUID"),
    front: z.string().min(1).max(2000).optional(),
    back: z.string().min(1).max(2000).optional(),
    collection_id: z.uuid("collection_id must be a valid UUID").nullable().optional(),
  })
  .refine((data) => data.front != null || data.back != null || data.collection_id !== undefined, {
    message: "At least one of front, back, or collection_id must be provided",
  });

export const DeleteFlashcardSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
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
      source: validation.data.source,
      generation_id: validation.data.generation_id,
      collection_id: validation.data.collection_id ?? null,
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

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = Object.fromEntries(context.url.searchParams);
  const validation = ListQuerySchema.safeParse(params);
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
    const result = await listFlashcards(supabase, context.locals.user.id, validation.data);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list flashcards";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PATCH: APIRoute = async (context) => {
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

  const validation = UpdateFlashcardSchema.safeParse(body);
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
    const { id, ...updates } = validation.data;
    const card = await updateFlashcard(supabase, context.locals.user.id, id, updates);

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err instanceof NotFoundError ? 404 : 500;
    const message = err instanceof Error ? err.message : "Failed to update flashcard";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async (context) => {
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

  const validation = DeleteFlashcardSchema.safeParse(body);
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
    await deleteFlashcard(supabase, context.locals.user.id, validation.data.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = err instanceof NotFoundError ? 404 : 500;
    const message = err instanceof Error ? err.message : "Failed to delete flashcard";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
