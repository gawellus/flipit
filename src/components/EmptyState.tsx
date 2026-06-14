import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center py-16 text-center", className)}>
      <div className="bg-primary/12 mb-5 flex size-[76px] items-center justify-center rounded-full">{icon}</div>
      <h3 className="text-fi-ink text-[22px] font-light tracking-[-0.01em]">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-sm text-[15px]">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
