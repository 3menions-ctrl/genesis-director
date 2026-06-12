import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-base = 16px = iOS Safari's threshold for "don't auto-zoom
          // on focus". Anything smaller fires the disorienting page-zoom
          // every time a mobile user taps the field. Audit gap H2.
          "flex h-11 w-full rounded-xl border border-border bg-background px-4 py-2 text-base sm:text-sm font-medium",
          // Targeted property transitions are cheaper than `transition-all`
          // (the old default forced layout on focus-ring expansion).
          "ring-offset-background transition-[box-shadow,border-color,background-color] duration-200",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground placeholder:font-normal",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:border-foreground/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
