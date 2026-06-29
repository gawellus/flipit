import { useCallback, useEffect, useState } from "react";
import type { CollectionWithCounts } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/Tag";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { BookOpen, FolderOpen, Plus, Trash2 } from "lucide-react";

export default function CollectionsView() {
  const [collections, setCollections] = useState<CollectionWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/collections")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load collections");
        }
        return res.json() as Promise<CollectionWithCounts[]>;
      })
      .then((data) => {
        if (!cancelled) setCollections(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Network error. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }, []);

  async function handleCreate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create collection");
      }
      setNewName("");
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create collection");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/collections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to delete collection");
      }
      setConfirmDeleteId(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Tag>Collections</Tag>
          <h1 className="text-fi-ink mt-2 text-[32px] font-light tracking-[-0.02em]">Study decks</h1>
          <p className="text-muted-foreground mt-1 text-[15px]">Choose a collection to study or create a new one.</p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(!showCreate);
          }}
        >
          {showCreate ? (
            "Cancel"
          ) : (
            <>
              <Plus className="size-4" />
              Create collection
            </>
          )}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-primary/30 mb-6">
          <CardContent>
            <form onSubmit={(e) => void handleCreate(e)} className="flex gap-3">
              <Input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                }}
                placeholder="Collection name..."
                aria-label="Collection name"
                maxLength={200}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={!newName.trim() || isCreating}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={36} />
          <p className="text-muted-foreground text-[15px]">Loading collections...</p>
        </div>
      )}

      {error && !isLoading && (
        <EmptyState
          icon={<FolderOpen className="size-8 text-[var(--fi-ruby)]" />}
          title="Something went wrong"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      )}

      {!isLoading && !error && collections.length === 0 && (
        <EmptyState
          icon={<FolderOpen className="text-primary size-8" />}
          title="No collections yet"
          description="Create a collection to start organizing and studying your flashcards."
          action={
            <Button
              onClick={() => {
                setShowCreate(true);
              }}
            >
              <Plus className="size-4" />
              Create collection
            </Button>
          }
        />
      )}

      {!isLoading && !error && collections.length > 0 && (
        <div className="grid grid-cols-1 gap-4 min-[760px]:grid-cols-2">
          {collections.map((collection) => (
            <Card key={collection.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/12 flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <BookOpen className="text-primary size-5" />
                  </div>
                  <h3 className="text-fi-ink min-w-0 flex-1 text-[17px] leading-snug font-medium">{collection.name}</h3>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center rounded-full border border-[var(--fi-hairline)] px-2.5 py-0.5 text-xs text-[var(--fi-ink-mute)] tabular-nums">
                      {collection.card_count} card{collection.card_count !== 1 ? "s" : ""}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs tabular-nums",
                        collection.due_count > 0
                          ? "bg-primary/12 text-fi-primary-deep"
                          : "border border-[var(--fi-hairline)] text-[var(--fi-ink-mute)]",
                      )}
                    >
                      {collection.due_count} due
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {confirmDeleteId === collection.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setConfirmDeleteId(null);
                          }}
                          disabled={deletingId === collection.id}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(collection.id)}
                          disabled={deletingId === collection.id}
                        >
                          {deletingId === collection.id ? "..." : "Delete"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-fi-ruby size-8"
                          aria-label="Delete collection"
                          onClick={() => {
                            setConfirmDeleteId(collection.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <a href={`/study/${collection.id}`}>
                          <Button size="sm" disabled={collection.card_count === 0}>
                            Study
                          </Button>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
