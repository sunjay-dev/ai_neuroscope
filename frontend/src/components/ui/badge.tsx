import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "concept" | "status" | "active";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 select-none",
        variant === "default" &&
          "border-transparent bg-violet-600 text-white shadow-xs hover:bg-violet-700",
        variant === "secondary" &&
          "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200/80",
        variant === "destructive" &&
          "border-transparent bg-red-500 text-white shadow-xs hover:bg-red-600",
        variant === "outline" &&
          "border-slate-200 text-slate-800 bg-white shadow-2xs",
        variant === "concept" &&
          "rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "status" &&
          "rounded-full px-2.5 py-0.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200",
        variant === "active" &&
          "rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-50 text-violet-700 border-violet-200 shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
