import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "text-foreground",
        secondary: "text-secondary-foreground",
        destructive: "text-[hsl(0_55%_40%)]",
        outline: "text-foreground hover:bg-white/[0.06]",
        success: "text-[hsl(145_55%_32%)]",
        warning: "text-[hsl(30_60%_35%)]",
        info: "text-[hsl(210_55%_40%)]",
        idle: "text-muted-foreground",
        generating: "text-foreground animate-pulse-soft",
        rendering: "text-foreground/80 animate-pulse-soft",
        completed: "text-[hsl(145_55%_32%)]",
        aurora: "text-foreground",
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
