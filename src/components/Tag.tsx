import { cn } from "@/lib/utils";

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "bg-primary/12 text-fi-primary-deep inline-block rounded-full px-3 py-1 text-[10px] font-normal tracking-[0.1px] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
