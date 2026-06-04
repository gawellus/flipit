import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onCreated: () => void;
}

export function CreateFlashcardForm({ onCreated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
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
      setIsOpen(false);
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
    setError(null);
    setIsOpen(false);
  }

  const canSave = front.trim().length > 0 && back.trim().length > 0 && front.length <= 2000 && back.length <= 2000;

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setIsOpen(true);
        }}
        className="border-white/20 text-white hover:bg-white/10"
      >
        Add flashcard
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-white/50">Front</label>
          <span className="text-xs text-white/30">{front.length}/2000</span>
        </div>
        <Textarea
          value={front}
          onChange={(e) => {
            setFront(e.target.value);
          }}
          placeholder="Question or term..."
          className="min-h-[60px] border-white/20 bg-white/5 text-white"
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-white/50">Back</label>
          <span className="text-xs text-white/30">{back.length}/2000</span>
        </div>
        <Textarea
          value={back}
          onChange={(e) => {
            setBack(e.target.value);
          }}
          placeholder="Answer or definition..."
          className="min-h-[60px] border-white/20 bg-white/5 text-white"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
