import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[8px] border border-[#1e2235] bg-[#0a0c14] p-3 text-[#e8eaf6]",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

export { Card };
