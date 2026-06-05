import type { IntervalPreview } from "@/types";
import { Button } from "@/components/ui/button";

const RATING_CONFIG = [
  { rating: 1, label: "Again", variant: "destructive" as const },
  { rating: 2, label: "Hard", variant: "outline" as const },
  { rating: 3, label: "Good", variant: "default" as const },
  { rating: 4, label: "Easy", variant: "secondary" as const },
];

interface RatingButtonsProps {
  previews: IntervalPreview[];
  onRate: (rating: number) => void;
  disabled: boolean;
}

export function RatingButtons({ previews, onRate, disabled }: RatingButtonsProps) {
  const previewMap = new Map(previews.map((p) => [p.rating, p.label]));

  return (
    <div className="flex justify-center gap-3">
      {RATING_CONFIG.map(({ rating, label, variant }) => (
        <Button
          key={rating}
          variant={variant}
          size="sm"
          disabled={disabled}
          onClick={() => {
            onRate(rating);
          }}
          className="flex flex-col gap-0.5 py-3"
        >
          <span>{label}</span>
          <span className="text-xs opacity-70">{previewMap.get(rating) ?? ""}</span>
        </Button>
      ))}
    </div>
  );
}
