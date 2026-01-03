import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/10 text-primary shadow-sm",
        secondary: "border-border/30 bg-secondary/50 text-secondary-foreground",
        destructive: "border-destructive/20 bg-destructive/10 text-destructive",
        outline: "border-border/30 bg-card/30 text-foreground backdrop-blur-sm",
        success: "border-success/20 bg-success/10 text-success",
        warning: "border-warning/20 bg-warning/10 text-warning",
        idle: "border-border/30 bg-muted/40 text-muted-foreground",
        generating: "border-primary/25 bg-primary/10 text-primary",
        rendering: "border-warning/25 bg-warning/10 text-warning",
        completed: "border-success/25 bg-success/10 text-success",
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