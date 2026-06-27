import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Button variants with GPU-accelerated transitions for instant feedback (<100ms).
 * Uses transform and opacity only - no layout-triggering properties.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium",
    // GPU-accelerated transitions for instant feedback
    "transition-[transform,opacity,background-color,box-shadow] duration-150 ease-out",
    "transform-gpu backface-hidden",
    // Focus states
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Icon sizing
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    // Instant active feedback (under 100ms)
    "active:scale-[0.97] active:opacity-90",
    // Touch optimization
    "touch-manipulation select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // Borderless ghost by default — no resting fill. Every <Button> in
        // the app inherits this, so it stays text-led with a subtle hover.
        default: [
          "text-foreground",
          "hover:bg-white/[0.06]",
        ].join(" "),
        destructive: [
          "text-destructive",
          "hover:bg-destructive/10",
        ].join(" "),
        outline: [
          "bg-transparent",
          "text-foreground",
          "hover:bg-white/[0.06]",
        ].join(" "),
        secondary: [
          "text-foreground",
          "hover:bg-white/[0.06]",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-white/[0.06]",
          "hover:text-foreground",
        ].join(" "),
        link: "text-foreground underline-offset-4 hover:underline",
        glow: [
          "relative overflow-hidden",
          "text-foreground",
          "hover:bg-white/[0.06]",
          "hover:-translate-y-0.5",
        ].join(" "),
        aurora: [
          "relative overflow-hidden",
          "text-foreground",
          "hover:bg-white/[0.06]",
          "hover:-translate-y-0.5",
        ].join(" "),
        glass: [
          "backdrop-blur-xl",
          "text-foreground",
          "hover:bg-white/[0.06]",
        ].join(" "),
        premium: [
          "relative overflow-hidden",
          "text-foreground font-semibold",
          "hover:bg-white/[0.06]",
          "hover:-translate-y-0.5",
        ].join(" "),
        pill: [
          // Landing-page "Enter Studio" CTA — borderless, text-led.
          "relative overflow-hidden rounded-full",
          "text-foreground font-semibold tracking-tight",
          "hover:bg-white/[0.06]",
          "hover:-translate-y-0.5",
        ].join(" "),
      },
      // Heights bumped to clear the iOS 44px touch-target minimum. Audit
      // gap H3. `sm` is intentionally just below for tight admin tables;
      // pages should use `default` or larger anywhere a real user taps.
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-[13px]",
        lg: "h-12 rounded-xl px-6",
        xl: "h-13 rounded-xl px-8 text-base font-semibold",
        pill: "h-11 rounded-full px-7 text-[13px] uppercase tracking-[0.18em]",
        icon: "h-11 w-11",
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
  /** Shows loading spinner and disables interaction */
  isLoading?: boolean;
  /** Text to show while loading (defaults to hiding children) */
  loadingText?: string;
}

/**
 * Button component with instant feedback and loading states.
 * Optimized for <100ms interaction response.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Show immediate visual feedback for loading state
    const isDisabled = disabled || isLoading;
    
    return (
      <Comp 
        className={cn(
          buttonVariants({ variant, size, className }),
          isLoading && "cursor-wait"
        )} 
        ref={ref} 
        disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {loadingText ? <span>{loadingText}</span> : <span className="opacity-0">{children}</span>}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
