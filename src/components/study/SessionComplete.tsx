import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock } from "lucide-react";

interface SessionCompleteProps {
  reviewedCount: number;
  nextDue: string | null;
}

function formatRelativeTime(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "now";

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function SessionComplete({ reviewedCount, nextDue }: SessionCompleteProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center py-12 text-center">
          <div className="bg-primary/12 mb-5 flex size-[76px] items-center justify-center rounded-full">
            <Trophy className="text-primary size-8" />
          </div>
          <h3 className="text-fi-ink text-[22px] font-light tracking-[-0.01em]">Session complete!</h3>
          <p className="text-muted-foreground mt-2 text-[15px]">
            You reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""}.
          </p>
          {nextDue && (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[14px]">
              <Clock className="size-3.5" />
              Next review in {formatRelativeTime(nextDue)}
            </p>
          )}
          <div className="mt-6">
            <a href="/study">
              <Button>Back to collections</Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
