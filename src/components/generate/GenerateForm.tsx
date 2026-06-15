import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_CHARS = 10_000;

interface Props {
  onSubmit: (sourceText: string) => void;
  isLoading: boolean;
}

export function GenerateForm({ onSubmit, isLoading }: Props) {
  const [text, setText] = useState("");

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = text.trim().length === 0;
  const isDisabled = isEmpty || isOverLimit || isLoading;

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDisabled) {
      onSubmit(text);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          placeholder="Paste your study text here..."
          className="min-h-[200px] resize-y pb-8"
          disabled={isLoading}
        />
        <span
          className={cn(
            "pointer-events-none absolute right-3 bottom-2 text-xs tabular-nums",
            isOverLimit
              ? "text-[var(--fi-ruby)]"
              : charCount > MAX_CHARS * 0.9
                ? "text-[var(--fi-lemon)]"
                : "text-muted-foreground",
          )}
        >
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>
      <Button type="submit" disabled={isDisabled} className="w-full">
        {isLoading ? "Generating..." : "Generate Flashcards"}
      </Button>
    </form>
  );
}
