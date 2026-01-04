import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: [
          "bg-foreground text-background",
          "shadow-[0_2px_8px_hsl(0_0%_0%/0.12)]",
          "hover:bg-foreground/90",
          "hover:shadow-[0_4px_16px_hsl(0_0%_0%/0.16)]",
          "hover:-translate-y-0.5",
        ].join(" "),
        destructive: [
          "bg-foreground/80 text-background",
          "hover:bg-foreground/70",
          "shadow-md",
        ].join(" "),
        outline: [
          "border border-border",
          "bg-transparent",
          "text-foreground",
          "hover:bg-muted",
          "hover:border-foreground/20",
        ].join(" "),
        secondary: [
          "bg-muted text-foreground",
          "border border-border",
          "hover:bg-muted/80",
          "hover:border-foreground/20",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-muted",
          "hover:text-foreground",
        ].join(" "),
        link: "text-foreground underline-offset-4 hover:underline",
        glow: [
          "relative overflow-hidden",
          "bg-foreground text-background",
          "shadow-[0_4px_16px_hsl(0_0%_0%/0.15)]",
          "hover:shadow-[0_8px_24px_hsl(0_0%_0%/0.2)]",
          "hover:-translate-y-0.5",
        ].join(" "),
        aurora: [
          "relative overflow-hidden",
          "bg-foreground text-background",
          "shadow-[0_4px_16px_hsl(0_0%_0%/0.15)]",
          "hover:shadow-[0_8px_24px_hsl(0_0%_0%/0.2)]",
          "hover:-translate-y-0.5",
        ].join(" "),
        glass: [
          "bg-background/60 backdrop-blur-xl",
          "border border-background/80",
          "text-foreground",
          "shadow-glass",
          "hover:bg-background/80",
          "hover:border-foreground/10",
        ].join(" "),
        premium: [
          "relative overflow-hidden",
          "bg-foreground text-background font-semibold",
          "shadow-[0_4px_20px_hsl(0_0%_0%/0.15)]",
          "hover:shadow-[0_8px_32px_hsl(0_0%_0%/0.2)]",
          "hover:-translate-y-0.5",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-[13px]",
        lg: "h-11 rounded-xl px-6",
        xl: "h-12 rounded-xl px-8 text-base font-semibold",
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
