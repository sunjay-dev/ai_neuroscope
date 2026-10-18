import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "interactive" | "flat" | "elevated";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border transition-all duration-200 text-slate-200 select-none",
        variant === "default" &&
          "border-white/[0.08] bg-[#0c0e17]/80 backdrop-blur-md p-5 shadow-lg shadow-black/40",
        variant === "interactive" &&
          "border-white/[0.08] bg-[#0c0e17]/70 backdrop-blur-md p-5 shadow-md hover:border-indigo-500/50 hover:bg-[#101322]/90 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer active:scale-[0.99]",
        variant === "elevated" &&
          "border-white/[0.1] bg-[#101322]/90 backdrop-blur-lg p-6 shadow-2xl shadow-black/60",
        variant === "flat" &&
          "border-white/[0.06] bg-white/[0.02] p-4",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
