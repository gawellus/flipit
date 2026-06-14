import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GradientMeshProps {
  style?: CSSProperties;
  className?: string;
}

export function GradientMesh({ style, className }: GradientMeshProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={style}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 80% 60% at 20% 40%, rgba(249,107,238,0.25) 0%, transparent 70%)",
            "radial-gradient(ellipse 60% 50% at 60% 30%, rgba(245,233,212,0.5) 0%, transparent 70%)",
            "radial-gradient(ellipse 70% 60% at 80% 60%, rgba(185,185,249,0.3) 0%, transparent 70%)",
            "radial-gradient(ellipse 50% 40% at 40% 70%, rgba(83,58,253,0.08) 0%, transparent 70%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
