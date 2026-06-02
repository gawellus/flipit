import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard, CreateFlashcardInput } from "@/types";

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
  }));

  const { data, error } = await supabase.from("flashcards").insert(rows).select();

  if (error) {
    throw new Error(`Failed to insert flashcards: ${error.message}`);
  }

  return data as Flashcard[];
}
