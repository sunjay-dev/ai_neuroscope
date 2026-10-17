import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "model" | "num";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center font-medium",
        variant === "default" && "rounded-full px-2.5 py-0.5 text-xs bg-[#1a1f35] text-[#8892b0]",
        variant === "model" &&
          "bg-[#1a1f35] border border-[#1e2235] rounded-[6px] px-3 py-[5px] text-[12px] text-[#e8eaf6] font-mono",
        variant === "num" &&
          "w-[22px] h-[22px] bg-[#7c6af0] rounded-full text-[11px] font-semibold text-white shrink-0",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
