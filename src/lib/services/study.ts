import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlashcardSRState, ReviewLog, StudyCard } from "@/types";
import { fsrs } from "ts-fsrs";
import { NotFoundError } from "@/lib/errors";

interface DueCardRow {
  flashcard_id: string;
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
  flashcards: { id: string; front: string; back: string; collection_id: string };
}

interface SRStateRow {
  flashcard_id: string;
  user_id: string;
  difficulty: number;
  due: string;
  elapsed_days: number;
  lapses: number;
  last_review: string | null;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: number;
}

export async function getDueCards(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
): Promise<StudyCard[]> {
  const { data, error } = await supabase
    .from("flashcard_sr_state")
    .select(
      "flashcard_id, difficulty, due, elapsed_days, lapses, last_review, learning_steps, reps, scheduled_days, stability, state, flashcards!inner(id, front, back, collection_id)",
    )
    .eq("user_id", userId)
    .eq("flashcards.collection_id", collectionId)
    .lte("due", new Date().toISOString())
    .order("due", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch due cards: ${error.message}`);
  }

  const rows = data as unknown as DueCardRow[];

  return rows.map((row) => ({
    id: row.flashcards.id,
    front: row.flashcards.front,
    back: row.flashcards.back,
    difficulty: row.difficulty,
    due: row.due,
    elapsed_days: row.elapsed_days,
    lapses: row.lapses,
    last_review: row.last_review,
    learning_steps: row.learning_steps,
    reps: row.reps,
    scheduled_days: row.scheduled_days,
    stability: row.stability,
    state: row.state,
  }));
}

export async function getNextDueDate(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("flashcard_sr_state")
    .select("due, flashcards!inner(collection_id)")
    .eq("user_id", userId)
    .eq("flashcards.collection_id", collectionId)
    .gt("due", new Date().toISOString())
    .order("due", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to fetch next due date: ${error.message}`);
  }

  if (data.length === 0) {
    return null;
  }

  return (data[0] as unknown as { due: string }).due;
}

export async function processReview(
  supabase: SupabaseClient,
  userId: string,
  flashcardId: string,
  rating: number,
): Promise<{ card: FlashcardSRState; log: ReviewLog }> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error: fetchError } = await supabase
    .from("flashcard_sr_state")
    .select("*")
    .eq("flashcard_id", flashcardId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new NotFoundError("Flashcard not found");
    }
    throw new Error(`Failed to fetch SR state: ${fetchError.message}`);
  }

  const srState = data as unknown as SRStateRow;

  const currentCard = {
    difficulty: srState.difficulty,
    due: new Date(srState.due),
    elapsed_days: srState.elapsed_days,
    lapses: srState.lapses,
    last_review: srState.last_review ? new Date(srState.last_review) : undefined,
    learning_steps: srState.learning_steps,
    reps: srState.reps,
    scheduled_days: srState.scheduled_days,
    stability: srState.stability,
    state: srState.state,
  };

  const scheduler = fsrs();
  const result = scheduler.next(currentCard, new Date(), rating);

  const updatedCard = result.card;
  const reviewLog = result.log;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data: rpcResult, error: rpcError } = await supabase.rpc("process_review", {
    p_flashcard_id: flashcardId,
    p_user_id: userId,
    p_difficulty: updatedCard.difficulty,
    p_due: updatedCard.due.toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_elapsed_days: updatedCard.elapsed_days,
    p_lapses: updatedCard.lapses,
    p_last_review: updatedCard.last_review?.toISOString() ?? null,
    p_learning_steps: updatedCard.learning_steps,
    p_reps: updatedCard.reps,
    p_scheduled_days: updatedCard.scheduled_days,
    p_stability: updatedCard.stability,
    p_state: updatedCard.state,
    p_log_rating: reviewLog.rating,
    p_log_state: reviewLog.state,
    p_log_difficulty: reviewLog.difficulty,
    p_log_stability: reviewLog.stability,
    p_log_due: reviewLog.due.toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_log_elapsed_days: reviewLog.elapsed_days,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    p_log_last_elapsed_days: reviewLog.last_elapsed_days,
    p_log_scheduled_days: reviewLog.scheduled_days,
    p_log_learning_steps: reviewLog.learning_steps,
    p_log_review: reviewLog.review.toISOString(),
  });

  if (rpcError) {
    if (rpcError.message.includes("Flashcard not found")) {
      throw new NotFoundError("Flashcard not found");
    }
    throw new Error(`Failed to process review: ${rpcError.message}`);
  }

  const rpcData = rpcResult as unknown as { card: FlashcardSRState; log: ReviewLog };

  return {
    card: rpcData.card,
    log: rpcData.log,
  };
}
