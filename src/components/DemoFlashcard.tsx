import { useState } from "react";
import { RotateCcw } from "lucide-react";

export function DemoFlashcard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="perspective-[1600px]">
      <div
        className={`relative h-[280px] w-[360px] cursor-pointer transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(.4,.05,.2,1)] [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Showing answer — click to flip back" : "Click to reveal answer"}
      >
        {/* Front */}
        <div className="absolute inset-0 rounded-xl border border-[var(--fi-hairline)] bg-white p-6 shadow-[var(--shadow-float)] [backface-visibility:hidden]">
          <div className="flex items-center justify-between">
            <span className="bg-primary/12 text-fi-primary-deep inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-normal uppercase">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="inline"
              >
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
              AI
            </span>
            <span className="text-fi-ink-mute text-xs">Card 1 of 12</span>
          </div>
          <p className="text-fi-ink-mute mt-6 text-xs tracking-wider uppercase">Question</p>
          <p className="text-fi-ink mt-2 text-xl leading-snug font-light">What is the powerhouse of the cell?</p>
          <div className="text-fi-ink-mute hover:border-primary hover:text-primary mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--fi-hairline)] py-3 text-sm transition-colors">
            <RotateCcw className="size-4" />
            Reveal answer
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center rounded-xl border-[1.5px] border-[var(--fi-ink)] bg-white p-6 shadow-[var(--shadow-float)] [backface-visibility:hidden]">
          <p className="text-primary mb-3 text-[11px] font-medium tracking-wider uppercase">Answer</p>
          <p className="text-fi-ink-secondary text-center text-xl leading-relaxed font-light">The mitochondria</p>
          <p className="text-muted-foreground mt-8 flex items-center gap-1.5 text-[13px]">
            <RotateCcw className="size-3.5" />
            Click to flip back
          </p>
        </div>
      </div>
    </div>
  );
}
