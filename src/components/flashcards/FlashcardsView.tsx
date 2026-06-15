import { useCallback, useEffect, useState } from "react";
import type { Collection, Flashcard, PaginatedResponse } from "@/types";
import { Tag } from "@/components/Tag";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Layers, Plus } from "lucide-react";
import { SearchInput } from "./SearchInput";
import { CreateFlashcardForm } from "./CreateFlashcardForm";
import { FlashcardListItem } from "./FlashcardListItem";
import { PaginationControls } from "./PaginationControls";

async function fetchCards(currentPage: number, currentSearch: string) {
  const params = new URLSearchParams({
    page: String(currentPage),
    pageSize: "10",
  });
  if (currentSearch) params.set("search", currentSearch);

  const res = await fetch(`/api/flashcards?${params.toString()}`);

  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to load flashcards");
  }

  return (await res.json()) as PaginatedResponse<Flashcard>;
}

export default function FlashcardsView() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    fetchCards(page, search)
      .then((data) => {
        if (cancelled) return;
        setFlashcards(data.data);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, refreshKey]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }, []);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    setIsLoading(true);
    setError(null);
  }

  function handleCreated() {
    setSearch("");
    setPage(1);
    setIsLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  }

  function handlePageChange(p: number) {
    setPage(p);
    setIsLoading(true);
    setError(null);
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Tag>My Flashcards</Tag>
          <h1 className="text-fi-ink mt-2 text-[32px] font-light tracking-[-0.02em]">Flashcards</h1>
          {!isLoading && !error && totalCount > 0 && (
            <p className="text-muted-foreground mt-1 text-[15px]">
              {totalCount} card{totalCount !== 1 ? "s" : ""} across all your collections.
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setIsFormOpen(true);
          }}
          disabled={isFormOpen}
        >
          <Plus className="size-4" />
          Add flashcard
        </Button>
      </div>

      <div className="mb-4">
        <SearchInput key={refreshKey} onChange={handleSearchChange} />
      </div>

      {isFormOpen && (
        <div className="mb-4">
          <CreateFlashcardForm
            onCreated={handleCreated}
            onClose={() => {
              setIsFormOpen(false);
            }}
          />
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={36} />
          <p className="text-muted-foreground text-[15px]">Loading flashcards...</p>
        </div>
      )}

      {error && !isLoading && (
        <EmptyState
          icon={<Layers className="size-8 text-[var(--fi-ruby)]" />}
          title="Something went wrong"
          description={error}
          action={
            <Button variant="outline" onClick={refresh}>
              Try again
            </Button>
          }
        />
      )}

      {!isLoading && !error && totalCount === 0 && !search && (
        <EmptyState
          icon={<Layers className="text-primary size-8" />}
          title="No flashcards yet"
          description="Create one manually or generate from text."
          action={
            <Button asChild>
              <a href="/generate">Generate from text</a>
            </Button>
          }
        />
      )}

      {!isLoading && !error && totalCount === 0 && search && (
        <EmptyState
          icon={<Layers className="text-muted-foreground size-8" />}
          title="No flashcards match your search"
          description="Try adjusting your search terms."
        />
      )}

      {!isLoading && !error && totalCount > 0 && (
        <>
          <div className="space-y-3">
            {flashcards.map((card) => (
              <FlashcardListItem
                key={card.id}
                flashcard={card}
                collections={collections}
                onUpdated={refresh}
                onDeleted={refresh}
              />
            ))}
          </div>
          <div className="mt-6">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
