import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";

interface SessionEmptyProps {
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

export function SessionEmpty({ nextDue }: SessionEmptyProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center py-12 text-center">
          <div className="mb-5 flex size-[76px] items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="size-8 text-green-600" />
          </div>
          <h3 className="text-fi-ink text-[22px] font-light tracking-[-0.01em]">All caught up!</h3>
          {nextDue ? (
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[14px]">
              <Clock className="size-3.5" />
              Next review in {formatRelativeTime(nextDue)}
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-[15px]">No cards assigned to this collection yet.</p>
          )}
          <div className="mt-6 flex gap-3">
            <a href="/study">
              <Button variant="secondary">Back to collections</Button>
            </a>
            {!nextDue && (
              <a href="/flashcards">
                <Button>Add cards</Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
