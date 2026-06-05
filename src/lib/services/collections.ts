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
  const [collectionsResult, countsResult, dueCountsResult] = await Promise.all([
    supabase.from("collections").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("flashcards").select("collection_id").eq("user_id", userId).not("collection_id", "is", null),
    supabase
      .from("flashcard_sr_state")
      .select("flashcard_id, flashcards!inner(collection_id)")
      .eq("user_id", userId)
      .lte("due", new Date().toISOString()),
  ]);

  if (collectionsResult.error) {
    throw new Error(`Failed to list collections: ${collectionsResult.error.message}`);
  }
  if (countsResult.error) {
    throw new Error(`Failed to count flashcards: ${countsResult.error.message}`);
  }
  if (dueCountsResult.error) {
    throw new Error(`Failed to count due cards: ${dueCountsResult.error.message}`);
  }

  const collections = collectionsResult.data as Collection[];
  const counts = countsResult.data;
  const dueCounts = dueCountsResult.data;

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
