import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
      <p className="text-2xl font-semibold text-green-300">All caught up!</p>
      {nextDue ? (
        <p className="mt-2 text-white/60">Next review in {formatRelativeTime(nextDue)}</p>
      ) : (
        <p className="mt-2 text-white/60">No cards assigned to this collection yet.</p>
      )}
      <div className="mt-6 flex justify-center gap-3">
        <a href="/study">
          <Button variant="outline">Back to Collections</Button>
        </a>
        <a href="/flashcards">
          <Button variant="secondary">Add Cards</Button>
        </a>
      </div>
    </div>
  );
}
