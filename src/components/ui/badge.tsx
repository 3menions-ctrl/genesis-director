import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        destructive: "border-foreground/20 bg-foreground/5 text-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-foreground/20 bg-foreground/10 text-foreground",
        warning: "border-foreground/15 bg-foreground/5 text-foreground",
        info: "border-border bg-muted text-muted-foreground",
        idle: "border-border bg-muted text-muted-foreground",
        generating: "border-foreground/20 bg-foreground text-background animate-pulse-soft",
        rendering: "border-foreground/15 bg-foreground/80 text-background animate-pulse-soft",
        completed: "border-foreground/20 bg-foreground text-background",
        aurora: "border-border bg-muted text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
