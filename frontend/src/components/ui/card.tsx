import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-4 text-slate-200 shadow-sm transition-all",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
