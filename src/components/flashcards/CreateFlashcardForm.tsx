import { useState } from "react";
import type { Collection } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CollectionPicker } from "@/components/collections/CollectionPicker";

interface Props {
  collections: Collection[];
  onCreated: () => void;
  onClose: () => void;
}

export function CreateFlashcardForm({ collections, onCreated, onClose }: Props) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          collection_id: collectionId,
          flashcards: [{ front: front.trim(), back: back.trim() }],
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to create flashcard");
        return;
      }

      setFront("");
      setBack("");
      setCollectionId(null);
      onClose();
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setFront("");
    setBack("");
    setCollectionId(null);
    setError(null);
    onClose();
  }

  const canSave = front.trim().length > 0 && back.trim().length > 0 && front.length <= 2000 && back.length <= 2000;

  return (
    <div className="border-primary bg-card space-y-4 rounded-xl border border-dashed px-6 py-5">
      <h3 className="text-primary text-lg font-light">New flashcard</h3>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-fi-ink-secondary text-[13px]">Front (question / term)</label>
          <span className="text-muted-foreground text-xs tabular-nums">{front.length} / 2000</span>
        </div>
        <Textarea
          value={front}
          onChange={(e) => {
            setFront(e.target.value);
          }}
          placeholder="Question or term..."
          className="min-h-[80px]"
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-fi-ink-secondary text-[13px]">Back (answer / definition)</label>
          <span className="text-muted-foreground text-xs tabular-nums">{back.length} / 2000</span>
        </div>
        <Textarea
          value={back}
          onChange={(e) => {
            setBack(e.target.value);
          }}
          placeholder="Answer or definition..."
          className="min-h-[80px]"
        />
      </div>
      <div>
        <label className="text-fi-ink-secondary mb-1 block text-[13px]">Collection</label>
        <CollectionPicker collections={collections} value={collectionId} onChange={setCollectionId} />
      </div>
      {error && <p className="text-sm text-[var(--fi-ruby)]">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? "Saving..." : "Save card"}
        </Button>
      </div>
    </div>
  );
}
