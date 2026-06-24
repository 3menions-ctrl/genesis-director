import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl overflow-hidden transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-white/[0.03] text-card-foreground border border-white/[0.06] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] hover:bg-white/[0.05]",
        glass: "bg-white/[0.04] backdrop-blur-2xl border border-white/[0.06] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] hover:bg-white/[0.06] hover:-translate-y-0.5",
        premium: "bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)] hover:bg-white/[0.08] hover:-translate-y-1",
        obsidian: "bg-gradient-to-br from-[hsl(0_0%_10%)] to-[hsl(0_0%_6%)] border border-[hsl(0_0%_18%)] text-white shadow-[0_8px_32px_hsl(0_0%_0%/0.3)] hover:shadow-[0_12px_48px_hsl(0_0%_0%/0.4)] hover:-translate-y-1",
        subtle: "bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] hover:bg-white/[0.04]",
        success: "bg-[hsl(145_50%_97%/0.9)] backdrop-blur-xl border border-[hsl(145_45%_75%/0.5)] text-[hsl(145_55%_28%)] shadow-[0_4px_24px_hsl(145_50%_40%/0.08)]",
        error: "bg-[hsl(0_50%_97%/0.9)] backdrop-blur-xl border border-[hsl(0_45%_80%/0.5)] text-[hsl(0_55%_35%)] shadow-[0_4px_24px_hsl(0_50%_50%/0.08)]",
        warning: "bg-[hsl(38_60%_97%/0.9)] backdrop-blur-xl border border-[hsl(38_50%_75%/0.5)] text-[hsl(30_60%_32%)] shadow-[0_4px_24px_hsl(38_60%_50%/0.08)]",
        info: "bg-[hsl(210_50%_97%/0.9)] backdrop-blur-xl border border-[hsl(210_45%_80%/0.5)] text-[hsl(210_55%_35%)] shadow-[0_4px_24px_hsl(210_60%_50%/0.08)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

// Layout components - NO forwardRef needed (pure styling, never used with asChild)
function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-xl font-semibold leading-none tracking-tight text-foreground", className)} {...props} />;
}

// FIX: Changed from <p> to <div> to allow nested block elements (icons, etc.)
// This prevents "validateDOMNesting: <div> cannot appear as descendant of <p>" warnings
function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, cardVariants, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
