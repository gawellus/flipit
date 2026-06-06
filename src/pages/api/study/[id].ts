import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { getDueCards, getNextDueDate } from "@/lib/services/study";

export const ParamsSchema = z.object({
  id: z.uuid("id must be a valid UUID"),
});

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const validation = ParamsSchema.safeParse({ id: context.params.id });
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
    const [cards, nextDue] = await Promise.all([
      getDueCards(supabase, context.locals.user.id, validation.data.id),
      getNextDueDate(supabase, context.locals.user.id, validation.data.id),
    ]);

    return new Response(JSON.stringify({ cards, nextDue }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch study session";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
