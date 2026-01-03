import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-sm shadow-primary/20",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20",
        outline: "text-foreground border-border/50 bg-background/50 backdrop-blur-sm",
        success: "border-transparent bg-success text-success-foreground shadow-sm shadow-success/20",
        warning: "border-transparent bg-warning text-warning-foreground shadow-sm shadow-warning/20",
        idle: "border-border/50 bg-muted/50 text-muted-foreground",
        generating: "border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/10",
        rendering: "border-warning/30 bg-warning/15 text-warning shadow-sm shadow-warning/10",
        completed: "border-success/30 bg-success/15 text-success shadow-sm shadow-success/10",
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