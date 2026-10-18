import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "model" | "num" | "concept" | "status" | "active";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors select-none",
        variant === "default" &&
          "rounded-full px-2.5 py-0.5 text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
        variant === "secondary" &&
          "rounded-lg px-2.5 py-1 text-xs bg-white/[0.04] text-slate-300 border border-white/[0.08]",
        variant === "outline" &&
          "rounded-lg px-2.5 py-1 text-xs border border-white/[0.12] text-slate-300",
        variant === "model" &&
          "bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-xs text-slate-200 font-mono tracking-tight",
        variant === "num" &&
          "w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[11px] font-mono text-indigo-300 shrink-0",
        variant === "status" &&
          "rounded-full px-2.5 py-0.5 text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono",
        variant === "concept" &&
          "rounded-lg px-2.5 py-1 text-xs font-mono font-medium",
        variant === "active" &&
          "rounded-full px-3 py-0.5 text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/50 shadow-sm shadow-sky-500/20",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
