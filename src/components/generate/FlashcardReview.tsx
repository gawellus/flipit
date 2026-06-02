import { useState } from "react";
import type { FlashcardProposal } from "@/types";
import { Button } from "@/components/ui/button";
import { FlashcardItem } from "./FlashcardItem";

type CardStatus = "pending" | "accepted" | "rejected" | "editing";

interface CardState {
  proposal: FlashcardProposal;
  status: CardStatus;
}

interface Props {
  proposals: FlashcardProposal[];
  generationId: string;
  onSaveComplete: (savedCount: number) => void;
}

export function FlashcardReview({ proposals, generationId, onSaveComplete }: Props) {
  const [cards, setCards] = useState<CardState[]>(() => proposals.map((p) => ({ proposal: p, status: "pending" })));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const acceptedCount = cards.filter((c) => c.status === "accepted").length;
  const totalCount = cards.length;

  function updateCard(index: number, update: Partial<CardState>) {
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)));
  }

  function handleAcceptAll() {
    setCards((prev) =>
      prev.map((c) =>
        c.status === "pending" || c.status === "rejected" || c.status === "editing" ? { ...c, status: "accepted" } : c,
      ),
    );
  }

  async function handleSave() {
    const accepted = cards.filter((c) => c.status === "accepted");
    if (accepted.length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generation_id: generationId,
          flashcards: accepted.map((c) => ({ front: c.proposal.front, back: c.proposal.back })),
        }),
      });

      const data = (await res.json()) as { saved_count?: number; error?: string };

      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save flashcards");
        return;
      }

      onSaveComplete(data.saved_count ?? accepted.length);
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl">
        <span className="text-sm text-white/70">
          {acceptedCount} of {totalCount} accepted
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAcceptAll}>
            Accept all
          </Button>
          <Button size="sm" onClick={handleSave} disabled={acceptedCount === 0 || isSaving}>
            {isSaving ? "Saving..." : `Save accepted (${acceptedCount})`}
          </Button>
        </div>
      </div>

      {acceptedCount === 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
          No cards accepted. Use &quot;Accept all&quot; or undo individual cards to select cards for saving.
        </div>
      )}

      {saveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {saveError}
        </div>
      )}

      <div className="space-y-3">
        {cards.map((card, index) => (
          <FlashcardItem
            key={index}
            proposal={card.proposal}
            status={card.status}
            onAccept={() => {
              updateCard(index, { status: "accepted" });
            }}
            onReject={() => {
              updateCard(index, { status: "rejected" });
            }}
            onEdit={() => {
              updateCard(index, { status: "editing" });
            }}
            onSaveEdit={(front, back) => {
              updateCard(index, { proposal: { front, back }, status: "accepted" });
            }}
            onCancelEdit={() => {
              updateCard(index, { status: "pending" });
            }}
            onUndo={() => {
              updateCard(index, { status: "pending" });
            }}
          />
        ))}
      </div>
    </div>
  );
}
