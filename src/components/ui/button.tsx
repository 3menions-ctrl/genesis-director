import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20",
        outline: "border border-border/50 bg-card/40 backdrop-blur-xl hover:bg-card/60 hover:border-primary/40 text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/30",
        ghost: "hover:bg-foreground/5 text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glow: [
          "relative overflow-hidden",
          "bg-gradient-to-r from-primary via-primary to-primary/80",
          "text-primary-foreground font-semibold",
          "shadow-lg shadow-primary/30",
          "hover:shadow-xl hover:shadow-primary/40",
          "before:absolute before:inset-0",
          "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          "before:translate-x-[-100%] hover:before:translate-x-[100%]",
          "before:transition-transform before:duration-700",
        ].join(" "),
        aurora: [
          "relative overflow-hidden",
          "bg-gradient-to-r from-primary via-[hsl(280,85%,60%)] to-accent",
          "text-white font-semibold",
          "shadow-lg",
          "hover:shadow-xl",
          "animate-gradient-shift",
        ].join(" "),
        glass: "bg-card/50 backdrop-blur-2xl border border-border/30 text-foreground hover:bg-card/70 hover:border-primary/30",
        premium: "bg-gradient-to-r from-warning via-amber-500 to-warning text-warning-foreground shadow-lg shadow-warning/25 hover:shadow-xl hover:shadow-warning/30 font-semibold",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-[13px]",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-base font-semibold",
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