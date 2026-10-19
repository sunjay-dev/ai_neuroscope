import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full rounded-lg border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[13px] text-slate-100 leading-relaxed placeholder:text-slate-500 focus:border-violet-500/80 focus:ring-1 focus:ring-violet-500/40 focus:outline-none transition-colors resize-none disabled:cursor-not-allowed disabled:opacity-50 font-sans shadow-inner",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
