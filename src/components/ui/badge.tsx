import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-300",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/10",
        secondary: "border-border/40 bg-secondary/60 text-secondary-foreground",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive",
        outline: "border-border/40 bg-card/50 text-foreground backdrop-blur-xl",
        success: "border-success/30 bg-success/15 text-success shadow-sm shadow-success/10",
        warning: "border-warning/30 bg-warning/15 text-warning shadow-sm shadow-warning/10",
        info: "border-info/30 bg-info/15 text-info shadow-sm shadow-info/10",
        idle: "border-border/40 bg-muted/50 text-muted-foreground",
        generating: "border-primary/30 bg-primary/15 text-primary animate-pulse",
        rendering: "border-warning/30 bg-warning/15 text-warning animate-pulse",
        completed: "border-success/30 bg-success/15 text-success",
        aurora: "border-primary/40 bg-gradient-to-r from-primary/20 via-[hsl(280,85%,60%)]/15 to-accent/20 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };