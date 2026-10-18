import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "primary" | "nav";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          // Sizes
          size === "default" && "h-9 px-4 py-2 text-xs font-medium rounded-md",
          size === "sm" && "h-8 rounded-md px-3 text-xs",
          size === "lg" && "h-10 rounded-md px-8 text-sm",
          size === "icon" && "h-9 w-9 rounded-md p-0",
          size === "icon-sm" && "h-7 w-7 rounded-md p-0 text-xs",
          // Variants
          variant === "default" &&
            "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700",
          variant === "primary" &&
            "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700",
          variant === "destructive" &&
            "bg-red-500 text-white shadow-xs hover:bg-red-600",
          variant === "outline" &&
            "border border-slate-200 bg-white text-slate-800 shadow-2xs hover:bg-slate-100 hover:text-slate-900",
          variant === "secondary" &&
            "bg-slate-100 text-slate-900 shadow-2xs hover:bg-slate-200/80 border border-slate-200/60",
          variant === "ghost" &&
            "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          variant === "link" &&
            "text-indigo-600 underline-offset-4 hover:underline",
          variant === "nav" &&
            "h-7 w-7 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs",
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
