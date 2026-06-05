-- Atomic review processing: updates SR state + inserts review log in one transaction.
-- Called from src/lib/services/study.ts via supabase.rpc('process_review', ...).
CREATE OR REPLACE FUNCTION process_review(
  p_flashcard_id uuid,
  p_user_id uuid,
  -- SR state fields
  p_difficulty float,
  p_due timestamptz,
  p_elapsed_days integer,
  p_lapses integer,
  p_last_review timestamptz,
  p_learning_steps integer,
  p_reps integer,
  p_scheduled_days integer,
  p_stability float,
  p_state smallint,
  -- Review log fields
  p_log_rating smallint,
  p_log_state smallint,
  p_log_difficulty float,
  p_log_stability float,
  p_log_due timestamptz,
  p_log_elapsed_days integer,
  p_log_last_elapsed_days integer,
  p_log_scheduled_days integer,
  p_log_learning_steps integer,
  p_log_review timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sr_state jsonb;
  v_review_log jsonb;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM flashcard_sr_state
    WHERE flashcard_id = p_flashcard_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Flashcard not found' USING ERRCODE = 'P0002';
  END IF;

  -- Update SR state
  UPDATE flashcard_sr_state SET
    difficulty = p_difficulty,
    due = p_due,
    elapsed_days = p_elapsed_days,
    lapses = p_lapses,
    last_review = p_last_review,
    learning_steps = p_learning_steps,
    reps = p_reps,
    scheduled_days = p_scheduled_days,
    stability = p_stability,
    state = p_state
  WHERE flashcard_id = p_flashcard_id AND user_id = p_user_id
  RETURNING to_jsonb(flashcard_sr_state.*) INTO v_sr_state;

  -- Insert review log
  INSERT INTO review_logs (
    flashcard_id, user_id, rating, state, difficulty, stability,
    due, elapsed_days, last_elapsed_days, scheduled_days, learning_steps, review
  ) VALUES (
    p_flashcard_id, p_user_id, p_log_rating, p_log_state, p_log_difficulty,
    p_log_stability, p_log_due, p_log_elapsed_days, p_log_last_elapsed_days,
    p_log_scheduled_days, p_log_learning_steps, p_log_review
  )
  RETURNING to_jsonb(review_logs.*) INTO v_review_log;

  RETURN jsonb_build_object('card', v_sr_state, 'log', v_review_log);
END;
$$;
