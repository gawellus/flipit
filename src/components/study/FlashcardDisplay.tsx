import { Button } from "@/components/ui/button";

interface FlashcardDisplayProps {
  front: string;
  back: string;
  flipped: boolean;
  onFlip: () => void;
}

export function FlashcardDisplay({ front, back, flipped, onFlip }: FlashcardDisplayProps) {
  return (
    <div className="mx-auto w-full max-w-lg perspective-[800px]">
      <div
        className={`relative transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}
      >
        {/* Front */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center [backface-visibility:hidden]">
          <p className="mb-1 text-xs tracking-wide text-white/40 uppercase">Question</p>
          <p className="text-lg whitespace-pre-wrap text-white">{front}</p>
          {!flipped && (
            <Button onClick={onFlip} className="mt-6">
              Show Answer
            </Button>
          )}
        </div>

        {/* Back */}
        <div className="absolute inset-0 [transform:rotateY(180deg)] rounded-xl border border-purple-400/20 bg-purple-950/30 p-8 text-center [backface-visibility:hidden]">
          <p className="mb-1 text-xs tracking-wide text-white/40 uppercase">Answer</p>
          <p className="text-lg whitespace-pre-wrap text-white">{back}</p>
        </div>
      </div>
    </div>
  );
}
