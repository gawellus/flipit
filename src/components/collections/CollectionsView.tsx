import { useCallback, useEffect, useState } from "react";
import type { CollectionWithCounts } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function CollectionsView() {
  const [collections, setCollections] = useState<CollectionWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-4">
      <h1 className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
        Study
      </h1>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/50">Choose a collection to study</p>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(!showCreate);
          }}
        >
          {showCreate ? "Cancel" : "Create Collection"}
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={(e) => void handleCreate(e)} className="mb-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
            }}
            placeholder="Collection name..."
            aria-label="Collection name"
            className="border-white/20 bg-white/5 text-white"
            maxLength={200}
            autoFocus
          />
          <Button type="submit" disabled={!newName.trim() || isCreating}>
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </form>
      )}

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-16 text-white/70">
          <div className="size-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          <p>Loading collections...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-300">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      )}

      {!isLoading && !error && collections.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">No collections yet — create one to start organizing your flashcards.</p>
        </div>
      )}

      {!isLoading && !error && collections.length > 0 && (
        <div className="space-y-3">
          {collections.map((collection) => (
            <Card key={collection.id} className="border-white/10 bg-white/5">
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-medium text-white">{collection.name}</h3>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="secondary" className="bg-white/10 text-white/70">
                        {collection.card_count} card{collection.card_count !== 1 ? "s" : ""}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          collection.due_count > 0 ? "bg-purple-600/50 text-purple-200" : "bg-white/10 text-white/50"
                        }
                      >
                        {collection.due_count} due
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/study/${collection.id}`}>
                      <Button size="sm" disabled={collection.card_count === 0}>
                        Study
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(collection.id)}
                      disabled={deletingId === collection.id}
                    >
                      {deletingId === collection.id ? "..." : "Delete"}
                    </Button>
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
