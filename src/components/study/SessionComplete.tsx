import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-8 text-center">
      <p className="text-2xl font-semibold text-green-300">Session complete!</p>
      <p className="mt-2 text-white/70">
        You reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""}.
      </p>
      {nextDue && <p className="mt-1 text-white/50">Next review in {formatRelativeTime(nextDue)}</p>}
      <a href="/study" className="mt-6 inline-block">
        <Button variant="outline">Back to Collections</Button>
      </a>
    </div>
  );
}
