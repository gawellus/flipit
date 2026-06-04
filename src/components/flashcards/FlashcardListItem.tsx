import { useState, useEffect, useRef } from "react";
import type { Flashcard } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  flashcard: Flashcard;
  onUpdated: () => void;
  onDeleted: () => void;
}

type Mode = "view" | "editing" | "confirming-delete";

export function FlashcardListItem({ flashcard, onUpdated, onDeleted }: Props) {
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

  const canSave =
    editFront.trim().length > 0 && editBack.trim().length > 0 && editFront.length <= 2000 && editBack.length <= 2000;

  if (mode === "editing") {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-white/50">Front</label>
              <Textarea
                value={editFront}
                onChange={(e) => {
                  setEditFront(e.target.value);
                }}
                className="min-h-[60px] border-white/20 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/50">Back</label>
              <Textarea
                value={editBack}
                onChange={(e) => {
                  setEditBack(e.target.value);
                }}
                className="min-h-[60px] border-white/20 bg-white/5 text-white"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
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
    <Card className="border-white/10 bg-white/5">
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <span className="text-xs text-white/40">Front</span>
                <p className="text-sm text-white">{flashcard.front}</p>
              </div>
              <div>
                <span className="text-xs text-white/40">Back</span>
                <p className="text-sm text-white/80">{flashcard.back}</p>
              </div>
            </div>
            <Badge
              className={flashcard.source === "ai" ? "bg-blue-600 text-white" : "bg-purple-600 text-white"}
              variant="secondary"
            >
              {flashcard.source === "ai" ? "AI" : "Manual"}
            </Badge>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleStartEdit}>
              Edit
            </Button>
            {mode === "confirming-delete" ? (
              <Button size="sm" variant="destructive" onClick={handleConfirmDelete} disabled={isSaving}>
                Confirm delete?
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={handleDeleteClick}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
