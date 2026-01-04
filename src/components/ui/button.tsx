import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90 shadow-lg shadow-foreground/10",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20",
        outline: "border border-border bg-background/80 backdrop-blur-sm hover:bg-muted hover:border-foreground/20 text-foreground",
        secondary: "bg-muted text-foreground hover:bg-muted/80 border border-border",
        ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        glow: [
          "relative overflow-hidden",
          "bg-foreground",
          "text-background font-medium",
          "shadow-lg shadow-foreground/15",
          "hover:shadow-xl hover:shadow-foreground/20",
          "hover:bg-foreground/90",
        ].join(" "),
        aurora: [
          "relative overflow-hidden",
          "bg-foreground",
          "text-background font-medium",
          "shadow-lg shadow-foreground/15",
          "hover:shadow-xl hover:shadow-foreground/20",
        ].join(" "),
        glass: "bg-background/70 backdrop-blur-xl border border-border text-foreground hover:bg-background/90 hover:border-foreground/20",
        premium: "bg-foreground text-background shadow-lg shadow-foreground/15 hover:shadow-xl hover:shadow-foreground/20 font-medium",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-[13px]",
        lg: "h-11 rounded-xl px-6",
        xl: "h-12 rounded-xl px-8 font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
