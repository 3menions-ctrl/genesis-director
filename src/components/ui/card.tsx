import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl overflow-hidden transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border border-border/60 shadow-sm hover:shadow-md hover:border-border",
        glass: "bg-white/65 backdrop-blur-2xl border border-white/70 shadow-[0_4px_24px_hsl(0_0%_0%/0.04)] hover:bg-white/75 hover:shadow-[0_8px_40px_hsl(0_0%_0%/0.06)] hover:-translate-y-0.5",
        premium: "bg-gradient-to-br from-white to-[hsl(0_0%_98%)] border border-[hsl(0_0%_92%)] shadow-[0_4px_24px_hsl(0_0%_0%/0.04)] hover:shadow-[0_8px_40px_hsl(0_0%_0%/0.06)] hover:-translate-y-1",
        obsidian: "bg-gradient-to-br from-[hsl(0_0%_10%)] to-[hsl(0_0%_6%)] border border-[hsl(0_0%_18%)] text-white shadow-[0_8px_32px_hsl(0_0%_0%/0.3)] hover:shadow-[0_12px_48px_hsl(0_0%_0%/0.4)] hover:-translate-y-1",
        subtle: "bg-[hsl(0_0%_96%)] border border-[hsl(0_0%_90%)] hover:bg-[hsl(0_0%_94%)]",
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

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight text-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, cardVariants, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
