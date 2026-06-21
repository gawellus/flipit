import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard, CreateFlashcardInput, PaginatedResponse } from "@/types";
import { NotFoundError } from "@/lib/errors";

export async function createFlashcards(
  supabase: SupabaseClient,
  userId: string,
  cards: CreateFlashcardInput[],
): Promise<Flashcard[]> {
  if (cards.length === 0) {
    return [];
  }

  const rows = cards.map((card) => ({
    user_id: userId,
    front: card.front,
    back: card.back,
    source: card.source,
    generation_id: card.generation_id ?? null,
    collection_id: card.collection_id ?? null,
  }));

  const { data, error } = await supabase.from("flashcards").insert(rows).select();

  if (error) {
    throw new Error(`Failed to insert flashcards: ${error.message}`);
  }

  return data as Flashcard[];
}

export async function listFlashcards(
  supabase: SupabaseClient,
  userId: string,
  options: { page: number; pageSize: number; search?: string },
): Promise<PaginatedResponse<Flashcard>> {
  const { page, pageSize, search } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("flashcards")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, "\\,").replace(/\./g, "\\.");
    const pattern = `%${escaped}%`;
    query = query.or(`front.ilike.${pattern},back.ilike.${pattern}`);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to list flashcards: ${error.message}`);
  }

  const totalCount = count ?? 0;

  return {
    data: data as Flashcard[],
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
  };
}

export async function updateFlashcard(
  supabase: SupabaseClient,
  userId: string,
  flashcardId: string,
  updates: { front?: string; back?: string; collection_id?: string | null },
): Promise<Flashcard> {
  const result = await supabase
    .from("flashcards")
    .update(updates)
    .eq("id", flashcardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (result.error) {
    if (result.error.code === "PGRST116") {
      throw new NotFoundError("Flashcard not found");
    }
    throw new Error(`Failed to update flashcard: ${result.error.message}`);
  }

  return result.data as Flashcard;
}

export async function deleteFlashcard(supabase: SupabaseClient, userId: string, flashcardId: string): Promise<void> {
  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", flashcardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError("Flashcard not found");
    }
    throw new Error(`Failed to delete flashcard: ${error.message}`);
  }
}
