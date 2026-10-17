import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "gradient" | "ghost" | "nav" | "segment";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-accent text-white hover:bg-accent/90",
          variant === "gradient" &&
            "w-full py-[11px] bg-gradient-to-br from-[#7c6af0] to-[#c47af0] text-white font-semibold rounded-[8px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait",
          variant === "ghost" &&
            "w-full py-2 px-2.5 rounded-[6px] bg-transparent border border-[#7c6af0] text-[#c47af0] text-[12px] hover:bg-[#1a1f35] transition-colors",
          variant === "nav" &&
            "w-[26px] h-[26px] bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[#e8eaf6] text-[14px] hover:border-[#7c6af0] hover:text-[#7c6af0] transition-colors",
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
