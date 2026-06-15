import { useState, useEffect, useRef } from "react";
import type { Collection, Flashcard } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Sparkles, PenLine } from "lucide-react";

interface Props {
  flashcard: Flashcard;
  collections: Collection[];
  onUpdated: () => void;
  onDeleted: () => void;
}

type Mode = "view" | "editing" | "confirming-delete";

export function FlashcardListItem({ flashcard, collections, onUpdated, onDeleted }: Props) {
  const [mode, setMode] = useState<Mode>("view");
  const [editFront, setEditFront] = useState(flashcard.front);
  const [editBack, setEditBack] = useState(flashcard.back);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  function handleStartEdit() {
    setEditFront(flashcard.front);
    setEditBack(flashcard.back);
    setError(null);
    setMode("editing");
  }

  async function handleSaveEdit() {
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flashcard.id, front: editFront.trim(), back: editBack.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update flashcard");
        return;
      }

      setMode("view");
      onUpdated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setError(null);
    setMode("view");
  }

  function handleDeleteClick() {
    setMode("confirming-delete");
    confirmTimerRef.current = setTimeout(() => {
      setMode("view");
    }, 3000);
  }

  async function handleConfirmDelete() {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flashcard.id }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to delete flashcard");
        setMode("view");
        return;
      }

      onDeleted();
    } catch {
      setError("Network error. Please try again.");
      setMode("view");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCollectionChange(collectionId: string | null) {
    try {
      const res = await fetch("/api/flashcards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: flashcard.id, collection_id: collectionId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update collection");
        return;
      }
      onUpdated();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  const canSave =
    editFront.trim().length > 0 && editBack.trim().length > 0 && editFront.length <= 2000 && editBack.length <= 2000;

  if (mode === "editing") {
    return (
      <Card className="border-primary">
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-fi-ink-secondary text-xs">Front</label>
                <span className="text-muted-foreground text-xs tabular-nums">{editFront.length}/2000</span>
              </div>
              <Textarea
                value={editFront}
                onChange={(e) => {
                  setEditFront(e.target.value);
                }}
                className="min-h-[60px]"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-fi-ink-secondary text-xs">Back</label>
                <span className="text-muted-foreground text-xs tabular-nums">{editBack.length}/2000</span>
              </div>
              <Textarea
                value={editBack}
                onChange={(e) => {
                  setEditBack(e.target.value);
                }}
                className="min-h-[60px]"
              />
            </div>
            {error && <p className="text-sm text-[var(--fi-ruby)]">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={!canSave || isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <CardContent>
        <div className="flex gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase",
                flashcard.source === "ai"
                  ? "bg-primary/12 text-fi-primary-deep"
                  : "bg-fi-violet-soft text-fi-violet-ink",
              )}
            >
              {flashcard.source === "ai" ? <Sparkles className="size-3" /> : <PenLine className="size-3" />}
              {flashcard.source === "ai" ? "AI" : "Manual"}
            </span>
            <p className="text-fi-ink text-[17px] font-light">{flashcard.front}</p>
            <p className="text-fi-ink-secondary text-[14.5px]">{flashcard.back}</p>
            <div className="flex items-center gap-2 pt-1">
              <select
                value={flashcard.collection_id ?? ""}
                onChange={(e) => void handleCollectionChange(e.target.value || null)}
                className="border-fi-hairline text-fi-ink-secondary rounded-full border bg-transparent px-3 py-1 text-xs"
              >
                <option value="">No collection</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              onClick={handleStartEdit}
              className="text-muted-foreground hover:text-fi-ink hover:bg-fi-canvas-soft rounded-lg p-2 transition-colors"
              aria-label="Edit flashcard"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="text-muted-foreground rounded-lg p-2 transition-colors hover:bg-[var(--fi-ruby)]/5 hover:text-[var(--fi-ruby)]"
              aria-label="Delete flashcard"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-[var(--fi-ruby)]">{error}</p>}
      </CardContent>

      {mode === "confirming-delete" && (
        <div className="border-t border-[var(--fi-ruby)]/20 bg-[var(--fi-ruby)]/8 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--fi-ruby)]">Delete this flashcard?</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
                  setMode("view");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleConfirmDelete} disabled={isSaving}>
                Delete
              </Button>
            </div>
          </div>
          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-[var(--fi-ruby)]/20">
            <div className="absolute inset-y-0 left-0 animate-[undo-shrink_3s_linear_forwards] rounded-full bg-[var(--fi-ruby)]" />
          </div>
        </div>
      )}
    </Card>
  );
}
