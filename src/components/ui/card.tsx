import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl overflow-hidden transition-all duration-300",
  {
    variants: {
      variant: {
        default: "text-card-foreground shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]",
        glass: "backdrop-blur-2xl shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] hover:-translate-y-0.5",
        premium: "backdrop-blur-2xl shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)] hover:-translate-y-1",
        obsidian: "text-white shadow-[0_8px_32px_hsl(0_0%_0%/0.3)] hover:shadow-[0_12px_48px_hsl(0_0%_0%/0.4)] hover:-translate-y-1",
        subtle: "backdrop-blur-xl",
        success: "backdrop-blur-xl text-[hsl(145_55%_28%)] shadow-[0_4px_24px_hsl(145_50%_40%/0.08)]",
        error: "backdrop-blur-xl text-[hsl(0_55%_35%)] shadow-[0_4px_24px_hsl(0_50%_50%/0.08)]",
        warning: "backdrop-blur-xl text-[hsl(30_60%_32%)] shadow-[0_4px_24px_hsl(38_60%_50%/0.08)]",
        info: "backdrop-blur-xl text-[hsl(210_55%_35%)] shadow-[0_4px_24px_hsl(210_60%_50%/0.08)]",
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
