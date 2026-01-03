import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-violet-200 bg-violet-50 text-violet-700",
        secondary: "border-gray-200 bg-gray-100 text-gray-600",
        destructive: "border-red-200 bg-red-50 text-red-600",
        outline: "border-gray-200 bg-white text-gray-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        info: "border-violet-200 bg-violet-50 text-violet-700",
        idle: "border-gray-200 bg-gray-100 text-gray-500",
        generating: "border-violet-200 bg-violet-50 text-violet-700 animate-pulse",
        rendering: "border-amber-200 bg-amber-50 text-amber-700 animate-pulse",
        completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
        aurora: "border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700",
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
