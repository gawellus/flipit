import { useCallback, useEffect, useState } from "react";
import type { Collection, Flashcard, PaginatedResponse } from "@/types";
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
    <div className="mt-4">
      <h1 className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
        My Flashcards
      </h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchInput key={refreshKey} onChange={handleSearchChange} />
        </div>
        <CreateFlashcardForm onCreated={handleCreated} />
      </div>

      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-16 text-white/70">
          <div className="size-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          <p>Loading flashcards...</p>
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

      {!isLoading && !error && totalCount === 0 && !search && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">No flashcards yet.</p>
          <p className="mt-1 text-sm text-white/40">
            Create one manually above or{" "}
            <a href="/generate" className="text-purple-300 hover:underline">
              generate from text
            </a>
            .
          </p>
        </div>
      )}

      {!isLoading && !error && totalCount === 0 && search && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-white/60">No flashcards match your search.</p>
        </div>
      )}

      {!isLoading && !error && totalCount > 0 && (
        <>
          <p className="mb-3 text-sm text-white/40">
            {totalCount} flashcard{totalCount !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
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
          <div className="mt-4">
            <PaginationControls page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </>
      )}
    </div>
  );
}
