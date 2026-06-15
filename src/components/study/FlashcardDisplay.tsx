import { RotateCcw } from "lucide-react";

interface FlashcardDisplayProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}

export function FlashcardDisplay({ front, back, flipped, onFlip }: FlashcardDisplayProps) {
  return (
    <div className="mx-auto w-full max-w-xl perspective-[1600px]">
      <div
        className={`relative min-h-[340px] cursor-pointer transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(.4,.05,.2,1)] [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onFlip();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Showing answer" : "Click to reveal answer"}
      >
        {/* Front */}
        <div className="border-primary absolute inset-0 flex flex-col items-center justify-center rounded-xl border-[1.5px] bg-white p-8 shadow-[var(--shadow-float)] [backface-visibility:hidden]">
          <p className="text-muted-foreground mb-4 text-[11px] font-medium tracking-wider uppercase">Question</p>
          <p className="text-fi-ink max-w-md text-center text-[27px] leading-snug font-light tracking-[-0.01em] whitespace-pre-wrap">
            {front}
          </p>
          {!flipped && (
            <p className="text-muted-foreground mt-8 flex items-center gap-1.5 text-[13px]">
              <RotateCcw className="size-3.5" />
              Tap the card or press Space to reveal
            </p>
          )}
        </div>

        {/* Back */}
        <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center rounded-xl border-[1.5px] border-[var(--fi-ink)] bg-white p-8 shadow-[var(--shadow-float)] [backface-visibility:hidden]">
          <p className="text-primary mb-4 text-[11px] font-medium tracking-wider uppercase">Answer</p>
          <p className="text-fi-ink-secondary max-w-md text-center text-[20px] leading-relaxed whitespace-pre-wrap">
            {back}
          </p>
          <p className="text-muted-foreground mt-8 text-[13px]">How well did you know it?</p>
        </div>
      </div>
    </div>
  );
}
