import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "primary" | "secondary" | "outline" | "ghost" | "nav" | "gradient" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080d] disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer",
          // Sizes
          size === "default" && "h-9 px-3.5 rounded-xl text-xs font-semibold",
          size === "sm" && "h-8 px-3 rounded-lg text-xs font-medium",
          size === "lg" && "h-10 px-4 rounded-xl text-sm font-semibold",
          size === "icon" && "h-8 w-8 rounded-lg p-0",
          size === "icon-sm" && "h-7 w-7 rounded-md p-0 text-xs",
          // Variants
          variant === "default" &&
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 hover:shadow-indigo-500/40 active:scale-[0.98]",
          variant === "primary" &&
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30 hover:shadow-indigo-500/40 active:scale-[0.98]",
          variant === "gradient" &&
            "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold shadow-md shadow-indigo-500/25 hover:opacity-95 hover:shadow-indigo-500/35 active:scale-[0.98]",
          variant === "secondary" &&
            "bg-white/[0.05] hover:bg-white/[0.09] text-slate-200 border border-white/[0.08] hover:border-white/[0.16] shadow-sm active:scale-[0.98]",
          variant === "outline" &&
            "border border-white/[0.12] bg-transparent text-slate-300 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.2] active:scale-[0.98]",
          variant === "ghost" &&
            "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] active:scale-[0.98]",
          variant === "nav" &&
            "h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.16] active:scale-95",
          variant === "destructive" &&
            "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:border-rose-500/50 active:scale-[0.98]",
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
