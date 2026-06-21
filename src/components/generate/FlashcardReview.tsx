import { useState, useEffect } from "react";
import type { Collection, FlashcardProposal } from "@/types";
import { Button } from "@/components/ui/button";
import { CollectionPicker } from "@/components/collections/CollectionPicker";
import { FlashcardItem } from "./FlashcardItem";

type CardStatus = "pending" | "accepted" | "rejected" | "editing";

interface CardState {
  id: string;
  proposal: FlashcardProposal;
  status: CardStatus;
}

interface Props {
  proposals: FlashcardProposal[];
  generationId: string;
  onSaveComplete: (savedCount: number) => void;
}

export function FlashcardReview({ proposals, generationId, onSaveComplete }: Props) {
  const [cards, setCards] = useState<CardState[]>(() =>
    proposals.map((p) => ({ id: crypto.randomUUID(), proposal: p, status: "pending" })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/collections")
      .then((res) => res.json() as Promise<Collection[]>)
      .then((data) => {
        if (!cancelled) setCollections(data);
      })
      .catch((_err: unknown) => {
        // Collections are optional — silently ignore fetch failures
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleDeselectAll() {
    setCards((prev) => prev.map((c) => (c.status === "accepted" ? { ...c, status: "pending" } : c)));
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
          collection_id: selectedCollectionId,
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

  const actionBar = (
    <div className="border-fi-hairline bg-fi-canvas flex items-center justify-between rounded-xl border px-4 py-3 shadow-[var(--shadow-card)]">
      <span className="text-muted-foreground text-sm tabular-nums">
        {acceptedCount} of {totalCount} accepted
      </span>
      <CollectionPicker collections={collections} value={selectedCollectionId} onChange={setSelectedCollectionId} />
      <div className="flex gap-2">
        {acceptedCount > 0 ? (
          <Button variant="outline" size="sm" onClick={handleDeselectAll}>
            Deselect all
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleAcceptAll}>
            Accept all
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={acceptedCount === 0 || isSaving}>
          {isSaving ? "Saving..." : `Save accepted (${acceptedCount})`}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {actionBar}

      {saveError && (
        <div className="rounded-lg border border-[var(--fi-ruby)]/20 bg-[var(--fi-ruby)]/5 px-4 py-2 text-sm text-[var(--fi-ruby)]">
          {saveError}
        </div>
      )}

      <div className="space-y-3">
        {cards.map((card, index) => (
          <FlashcardItem
            key={card.id}
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

      {actionBar}
    </div>
  );
}
