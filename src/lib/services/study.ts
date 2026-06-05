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
  const { data: updatedState, error: updateError } = await supabase
    .from("flashcard_sr_state")
    .update({
      difficulty: updatedCard.difficulty,
      due: updatedCard.due.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      elapsed_days: updatedCard.elapsed_days,
      lapses: updatedCard.lapses,
      last_review: updatedCard.last_review?.toISOString() ?? null,
      learning_steps: updatedCard.learning_steps,
      reps: updatedCard.reps,
      scheduled_days: updatedCard.scheduled_days,
      stability: updatedCard.stability,
      state: updatedCard.state,
    })
    .eq("flashcard_id", flashcardId)
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update SR state: ${updateError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data: logData, error: logError } = await supabase
    .from("review_logs")
    .insert({
      flashcard_id: flashcardId,
      user_id: userId,
      rating: reviewLog.rating,
      state: reviewLog.state,
      difficulty: reviewLog.difficulty,
      stability: reviewLog.stability,
      due: reviewLog.due.toISOString(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      elapsed_days: reviewLog.elapsed_days,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      last_elapsed_days: reviewLog.last_elapsed_days,
      scheduled_days: reviewLog.scheduled_days,
      learning_steps: reviewLog.learning_steps,
      review: reviewLog.review.toISOString(),
    })
    .select()
    .single();

  if (logError) {
    throw new Error(`Failed to insert review log: ${logError.message}`);
  }

  return {
    card: updatedState as unknown as FlashcardSRState,
    log: logData as unknown as ReviewLog,
  };
}
