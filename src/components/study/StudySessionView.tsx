import { useEffect, useState } from "react";
import { fsrs, Rating } from "ts-fsrs";
import type { StudyCard, IntervalPreview } from "@/types";
import { FlashcardDisplay } from "./FlashcardDisplay";
import { RatingButtons } from "./RatingButtons";
import { SessionEmpty } from "./SessionEmpty";
import { SessionComplete } from "./SessionComplete";

type State =
  | { step: "loading" }
  | { step: "empty"; nextDue: string | null }
  | { step: "studying"; cards: StudyCard[]; currentIndex: number; flipped: boolean; previews: IntervalPreview[] }
  | { step: "complete"; reviewedCount: number; nextDue: string | null }
  | { step: "error"; message: string };

function formatInterval(due: Date): string {
  const diff = due.getTime() - Date.now();
  if (diff <= 0) return "<1m";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function computePreviews(card: StudyCard): IntervalPreview[] {
  const scheduler = fsrs();
  const cardInput = {
    difficulty: card.difficulty,
    due: new Date(card.due),
    elapsed_days: card.elapsed_days,
    lapses: card.lapses,
    last_review: card.last_review ? new Date(card.last_review) : undefined,
    learning_steps: card.learning_steps,
    reps: card.reps,
    scheduled_days: card.scheduled_days,
    stability: card.stability,
    state: card.state,
  };

  const preview = scheduler.repeat(cardInput, new Date());

  return [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((rating) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const due = preview[rating].card.due as Date;
    return { rating, label: formatInterval(due) };
  });
}

export default function StudySessionView({ collectionId }: { collectionId: string }) {
  const [state, setState] = useState<State>({ step: "loading" });
  const [isRating, setIsRating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/study/${collectionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load study session");
        }
        return res.json() as Promise<{ cards: StudyCard[]; nextDue: string | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.cards.length === 0) {
          setState({ step: "empty", nextDue: data.nextDue });
        } else {
          setState({
            step: "studying",
            cards: data.cards,
            currentIndex: 0,
            flipped: false,
            previews: [],
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ step: "error", message: err instanceof Error ? err.message : "Network error" });
      });

    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  function handleFlip() {
    if (state.step !== "studying") return;
    const card = state.cards[state.currentIndex];
    const previews = computePreviews(card);
    setState({ ...state, flipped: true, previews });
  }

  async function handleRate(rating: number) {
    if (state.step !== "studying") return;
    const card = state.cards[state.currentIndex];

    setIsRating(true);
    try {
      const res = await fetch("/api/study/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashcard_id: card.id, rating }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to submit review");
      }

      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= state.cards.length) {
        const dueRes = await fetch(`/api/study/${collectionId}`);
        const dueData = (await dueRes.json()) as { nextDue: string | null };
        setState({ step: "complete", reviewedCount: state.cards.length, nextDue: dueData.nextDue });
      } else {
        setState({ ...state, currentIndex: nextIndex, flipped: false, previews: [] });
      }
    } catch (err: unknown) {
      setState({ step: "error", message: err instanceof Error ? err.message : "Failed to submit review" });
    } finally {
      setIsRating(false);
    }
  }

  function handleRetry() {
    setState({ step: "loading" });
    fetch(`/api/study/${collectionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load study session");
        }
        return res.json() as Promise<{ cards: StudyCard[]; nextDue: string | null }>;
      })
      .then((data) => {
        if (data.cards.length === 0) {
          setState({ step: "empty", nextDue: data.nextDue });
        } else {
          setState({ step: "studying", cards: data.cards, currentIndex: 0, flipped: false, previews: [] });
        }
      })
      .catch((err: unknown) => {
        setState({ step: "error", message: err instanceof Error ? err.message : "Network error" });
      });
  }

  return (
    <div className="mt-4">
      <h1 className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
        Study Session
      </h1>

      {state.step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16 text-white/70">
          <div className="size-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          <p>Loading cards...</p>
        </div>
      )}

      {state.step === "empty" && <SessionEmpty nextDue={state.nextDue} />}

      {state.step === "studying" && (
        <div className="space-y-6">
          <p className="text-center text-sm text-white/50">
            Card {state.currentIndex + 1} of {state.cards.length}
          </p>
          <FlashcardDisplay
            front={state.cards[state.currentIndex].front}
            back={state.cards[state.currentIndex].back}
            flipped={state.flipped}
            onFlip={handleFlip}
          />
          {state.flipped && (
            <RatingButtons previews={state.previews} onRate={(r) => void handleRate(r)} disabled={isRating} />
          )}
        </div>
      )}

      {state.step === "complete" && <SessionComplete reviewedCount={state.reviewedCount} nextDue={state.nextDue} />}

      {state.step === "error" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-300">{state.message}</p>
          <button
            onClick={handleRetry}
            className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
