import { useState } from "react";
import type { FlashcardProposal } from "@/types";
import { Tag } from "@/components/Tag";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CircleCheck, CircleAlert } from "lucide-react";
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
        detail?: string;
      };

      if (!res.ok) {
        if (data.detail) console.error("[GenerateView] LLM error detail:", data.detail);
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
    <div>
      <div className="mb-8">
        <Tag>AI Generation</Tag>
        <h1 className="text-fi-ink mt-2 text-[32px] font-light tracking-[-0.02em]">Generate Flashcards</h1>
        <p className="text-muted-foreground mt-1 text-[15px]">Paste your study text and let AI create flashcards</p>
      </div>

      {state.step === "input" && <GenerateForm onSubmit={handleGenerate} isLoading={false} />}

      {state.step === "loading" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size={36} />
          <p className="text-muted-foreground text-[15px]">Generating flashcards...</p>
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
        <Card className="p-8 text-center">
          <CardContent className="flex flex-col items-center gap-3 p-0">
            <div className="flex size-[76px] items-center justify-center rounded-full bg-green-500/12">
              <CircleCheck className="size-9 text-green-600" />
            </div>
            <p className="text-fi-ink text-lg font-medium">
              {state.count} flashcard{state.count !== 1 ? "s" : ""} saved!
            </p>
            <Button variant="outline" onClick={handleReset} className="mt-2">
              Generate more
            </Button>
          </CardContent>
        </Card>
      )}

      {state.step === "error" && (
        <Card className="p-8 text-center">
          <CardContent className="flex flex-col items-center gap-3 p-0">
            <div className="flex size-[76px] items-center justify-center rounded-full bg-[var(--fi-ruby)]/12">
              <CircleAlert className="size-9 text-[var(--fi-ruby)]" />
            </div>
            <p className="text-fi-ink">{state.message}</p>
            <Button variant="outline" onClick={handleReset} className="mt-2">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
