import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "model" | "num" | "concept" | "status";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors select-none",
        variant === "default" &&
          "rounded-full px-2 py-0.5 text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
        variant === "secondary" &&
          "rounded-md px-2 py-0.5 text-[11px] bg-white/[0.05] text-slate-300 border border-white/[0.08]",
        variant === "outline" &&
          "rounded-md px-2 py-0.5 text-[11px] border border-white/[0.12] text-slate-300",
        variant === "model" &&
          "bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-[11px] text-slate-200 font-mono tracking-tight",
        variant === "num" &&
          "w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 shrink-0",
        variant === "status" &&
          "rounded-full px-2 py-0.5 text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        variant === "concept" &&
          "rounded-md px-2 py-0.5 text-[11px] font-mono font-medium",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
