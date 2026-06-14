import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className="text-fi-ruby flex items-center gap-2 rounded-lg border border-[var(--fi-ruby)]/20 bg-[var(--fi-ruby)]/5 px-3 py-2 text-sm">
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
