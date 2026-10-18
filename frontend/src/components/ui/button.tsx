import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "nav" | "gradient";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer",
          // Sizes
          size === "default" && "h-8 px-3 rounded-md",
          size === "sm" && "h-7 px-2.5 rounded-md text-[11px]",
          size === "lg" && "h-9 px-4 rounded-lg text-sm",
          size === "icon" && "h-7 w-7 rounded-md p-0",
          // Variants
          variant === "default" &&
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow-indigo-500/20 active:scale-[0.98]",
          variant === "primary" &&
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm hover:shadow-indigo-500/20 active:scale-[0.98]",
          variant === "gradient" &&
            "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold shadow-md shadow-indigo-500/20 hover:opacity-95 hover:shadow-indigo-500/30 active:scale-[0.98]",
          variant === "secondary" &&
            "bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] hover:border-white/[0.15] active:scale-[0.98]",
          variant === "outline" &&
            "border border-white/[0.12] bg-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.2]",
          variant === "ghost" &&
            "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
          variant === "nav" &&
            "h-7 w-7 rounded-md bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.16] active:scale-95",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
