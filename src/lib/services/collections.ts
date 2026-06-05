import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection, CollectionWithCounts } from "@/types";
import { NotFoundError } from "@/lib/errors";

export async function createCollection(supabase: SupabaseClient, userId: string, name: string): Promise<Collection> {
  const result = await supabase.from("collections").insert({ user_id: userId, name }).select().single();

  if (result.error) {
    throw new Error(`Failed to create collection: ${result.error.message}`);
  }

  return result.data as Collection;
}

export async function listCollections(supabase: SupabaseClient, userId: string): Promise<CollectionWithCounts[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list collections: ${error.message}`);
  }

  const collections = data as Collection[];

  const { data: counts, error: countsError } = await supabase
    .from("flashcards")
    .select("collection_id")
    .eq("user_id", userId)
    .not("collection_id", "is", null);

  if (countsError) {
    throw new Error(`Failed to count flashcards: ${countsError.message}`);
  }

  const { data: dueCounts, error: dueError } = await supabase
    .from("flashcard_sr_state")
    .select("flashcard_id, flashcards!inner(collection_id)")
    .eq("user_id", userId)
    .lte("due", new Date().toISOString());

  if (dueError) {
    throw new Error(`Failed to count due cards: ${dueError.message}`);
  }

  const cardCountMap = new Map<string, number>();
  for (const row of counts) {
    const cid = row.collection_id as string;
    cardCountMap.set(cid, (cardCountMap.get(cid) ?? 0) + 1);
  }

  const dueCountMap = new Map<string, number>();
  for (const row of dueCounts) {
    const cid = (row.flashcards as unknown as { collection_id: string | null }).collection_id;
    if (cid) {
      dueCountMap.set(cid, (dueCountMap.get(cid) ?? 0) + 1);
    }
  }

  return collections.map((c) => ({
    ...c,
    card_count: cardCountMap.get(c.id) ?? 0,
    due_count: dueCountMap.get(c.id) ?? 0,
  }));
}

export async function deleteCollection(supabase: SupabaseClient, userId: string, collectionId: string): Promise<void> {
  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError("Collection not found");
    }
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}
