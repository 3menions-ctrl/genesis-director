import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border/60 bg-muted/80 text-foreground",
        secondary: "border-border/60 bg-secondary text-secondary-foreground",
        destructive: "border-[hsl(0_45%_80%/0.5)] bg-[hsl(0_50%_97%/0.9)] text-[hsl(0_55%_40%)]",
        outline: "border-border bg-transparent text-foreground hover:bg-muted/50",
        success: "border-[hsl(145_45%_75%/0.5)] bg-[hsl(145_50%_97%/0.9)] text-[hsl(145_55%_32%)]",
        warning: "border-[hsl(38_50%_75%/0.5)] bg-[hsl(38_60%_97%/0.9)] text-[hsl(30_60%_35%)]",
        info: "border-[hsl(210_45%_80%/0.5)] bg-[hsl(210_50%_97%/0.9)] text-[hsl(210_55%_40%)]",
        idle: "border-border/50 bg-muted/60 text-muted-foreground",
        generating: "border-foreground/20 bg-foreground text-background animate-pulse-soft",
        rendering: "border-foreground/15 bg-foreground/80 text-background animate-pulse-soft",
        completed: "border-[hsl(145_45%_60%/0.5)] bg-[hsl(145_50%_95%/0.9)] text-[hsl(145_55%_32%)]",
        aurora: "border-border/40 bg-muted/50 text-foreground",
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
