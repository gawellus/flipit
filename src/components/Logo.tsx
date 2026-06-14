import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 28, showWordmark = true, className }: LogoProps) {
  return (
    <a href="/" className={cn("flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#1c1e54" />
        <path d="M11 8l6 6-6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showWordmark && (
        <span className="text-fi-ink text-[20px] font-light tracking-[-0.02em]">
          Flip<span className="font-normal">It</span>
        </span>
      )}
    </a>
  );
}
