import { useCallback, useEffect, useState } from "react";
import { fsrs, Rating } from "ts-fsrs";
import type { StudyCard, IntervalPreview } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { FlashcardDisplay } from "./FlashcardDisplay";
import { RatingButtons } from "./RatingButtons";
import { SessionEmpty } from "./SessionEmpty";
import { SessionComplete } from "./SessionComplete";
import { ChevronLeft } from "lucide-react";

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
  const [refreshKey, setRefreshKey] = useState(0);

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
  }, [collectionId, refreshKey]);

  const handleRetry = useCallback(() => {
    setState({ step: "loading" });
    setRefreshKey((k) => k + 1);
  }, []);

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

  const progress =
    state.step === "studying" ? ((state.currentIndex + (state.flipped ? 0.5 : 0)) / state.cards.length) * 100 : 0;

  return (
    <div>
      <a
        href="/study"
        className="text-muted-foreground hover:text-fi-ink mb-6 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ChevronLeft className="size-4" />
        Back to collections
      </a>

      {state.step === "loading" && (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-16">
              <Spinner size={36} />
              <p className="text-muted-foreground text-[15px]">Loading cards...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === "empty" && <SessionEmpty nextDue={state.nextDue} />}

      {state.step === "studying" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              Card {state.currentIndex + 1} of {state.cards.length}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fi-canvas-soft)]">
              <div
                className="to-primary h-full rounded-full bg-gradient-to-r from-[var(--fi-primary-deep)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

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
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-[76px] items-center justify-center rounded-full bg-[var(--fi-ruby)]/12">
                <svg className="size-8 text-[var(--fi-ruby)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h3 className="text-fi-ink text-[22px] font-light tracking-[-0.01em]">Something went wrong</h3>
              <p className="text-muted-foreground max-w-sm text-[15px]">{state.message}</p>
              <div className="mt-3">
                <Button variant="outline" onClick={handleRetry}>
                  Try again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
