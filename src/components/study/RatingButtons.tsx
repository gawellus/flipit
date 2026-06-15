import type { IntervalPreview } from "@/types";
import { cn } from "@/lib/utils";

const RATING_CONFIG = [
  {
    rating: 1,
    label: "Again",
    hoverClass: "hover:border-[var(--fi-ruby)] hover:bg-[var(--fi-ruby)]/5 hover:text-[var(--fi-ruby)]",
  },
  {
    rating: 2,
    label: "Hard",
    hoverClass: "hover:border-[var(--fi-lemon)] hover:bg-[var(--fi-lemon)]/5 hover:text-[var(--fi-lemon)]",
  },
  {
    rating: 3,
    label: "Good",
    hoverClass: "hover:border-primary hover:bg-primary/5 hover:text-primary",
  },
  {
    rating: 4,
    label: "Easy",
    hoverClass: "hover:border-green-600 hover:bg-green-600/5 hover:text-green-600",
  },
];

interface RatingButtonsProps {
  previews: IntervalPreview[];
  onRate: (rating: number) => void;
  disabled: boolean;
}

export function RatingButtons({ previews, onRate, disabled }: RatingButtonsProps) {
  const previewMap = new Map(previews.map((p) => [p.rating, p.label]));

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-3 min-[560px]:grid-cols-4">
      {RATING_CONFIG.map(({ rating, label, hoverClass }) => (
        <button
          key={rating}
          disabled={disabled}
          onClick={() => {
            onRate(rating);
          }}
          className={cn(
            "text-fi-ink flex flex-col items-center gap-1 rounded-lg border border-[var(--fi-hairline)] bg-white px-4 py-4 transition-all duration-150",
            !disabled && hoverClass,
            !disabled && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]",
            disabled && "opacity-40",
          )}
        >
          <span className="text-sm font-medium">{label}</span>
          <span className="text-muted-foreground text-xs tabular-nums">{previewMap.get(rating) ?? ""}</span>
        </button>
      ))}
    </div>
  );
}
