import { useState } from "react";
import type { FlashcardProposal } from "@/types";
import { GenerateForm } from "./GenerateForm";
import { FlashcardReview } from "./FlashcardReview";

type State =
  | { step: "input" }
  | { step: "loading" }
  | { step: "review"; proposals: FlashcardProposal[]; generationId: string }
  | { step: "saved"; count: number }
  | { step: "error"; message: string };

export default function GenerateView() {
  const [state, setState] = useState<State>({ step: "input" });

  async function handleGenerate(sourceText: string) {
    setState({ step: "loading" });

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_text: sourceText }),
      });

      const data = (await res.json()) as {
        generation_id?: string;
        flashcards?: FlashcardProposal[];
        error?: string;
      };

      if (!res.ok) {
        setState({ step: "error", message: data.error ?? "Generation failed" });
        return;
      }

      setState({
        step: "review",
        proposals: data.flashcards ?? [],
        generationId: data.generation_id ?? "",
      });
    } catch {
      setState({ step: "error", message: "Network error. Please check your connection and try again." });
    }
  }

  function handleSaveComplete(savedCount: number) {
    setState({ step: "saved", count: savedCount });
  }

  function handleReset() {
    setState({ step: "input" });
  }

  return (
    <div className="mt-4">
      <h1 className="mb-6 bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
        Generate Flashcards
      </h1>

      {state.step === "input" && <GenerateForm onSubmit={handleGenerate} isLoading={false} />}

      {state.step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16 text-white/70">
          <div className="size-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          <p>Generating flashcards...</p>
        </div>
      )}

      {state.step === "review" && (
        <FlashcardReview
          proposals={state.proposals}
          generationId={state.generationId}
          onSaveComplete={handleSaveComplete}
        />
      )}

      {state.step === "saved" && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
          <p className="text-lg font-semibold text-green-300">
            {state.count} flashcard{state.count !== 1 ? "s" : ""} saved!
          </p>
          <button
            onClick={handleReset}
            className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Generate more
          </button>
        </div>
      )}

      {state.step === "error" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
          <p className="text-red-300">{state.message}</p>
          <button
            onClick={handleReset}
            className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
