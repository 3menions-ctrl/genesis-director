import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-2xl border p-4 backdrop-blur-xl [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-background/90 text-foreground border-border [&>svg]:text-foreground",
        destructive: "bg-[hsl(0_50%_97%/0.9)] text-[hsl(0_55%_35%)] border-[hsl(0_45%_80%/0.5)] [&>svg]:text-[hsl(0_55%_50%)]",
        success: "bg-[hsl(145_50%_97%/0.9)] text-[hsl(145_55%_28%)] border-[hsl(145_45%_75%/0.5)] [&>svg]:text-[hsl(145_55%_38%)]",
        warning: "bg-[hsl(38_60%_97%/0.9)] text-[hsl(30_60%_32%)] border-[hsl(38_50%_75%/0.5)] [&>svg]:text-[hsl(38_70%_45%)]",
        info: "bg-[hsl(210_50%_97%/0.9)] text-[hsl(210_55%_35%)] border-[hsl(210_45%_80%/0.5)] [&>svg]:text-[hsl(210_55%_50%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
