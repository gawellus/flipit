import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 32, className }: SpinnerProps) {
  return (
    <div
      className={cn("border-primary/18 border-t-primary animate-spin rounded-full border-[3px]", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
