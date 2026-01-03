import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-500/25",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20",
        outline: "border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-700",
        secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
        ghost: "hover:bg-gray-100 text-gray-600 hover:text-gray-900",
        link: "text-violet-600 underline-offset-4 hover:underline",
        glow: [
          "relative overflow-hidden",
          "bg-gradient-to-r from-violet-600 to-purple-600",
          "text-white font-medium",
          "shadow-lg shadow-violet-500/30",
          "hover:shadow-xl hover:shadow-violet-500/40",
          "hover:from-violet-700 hover:to-purple-700",
        ].join(" "),
        aurora: [
          "relative overflow-hidden",
          "bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600",
          "text-white font-medium",
          "shadow-lg shadow-violet-500/30",
          "hover:shadow-xl hover:shadow-violet-500/40",
        ].join(" "),
        glass: "bg-white/80 backdrop-blur-xl border border-gray-200 text-gray-700 hover:bg-white hover:border-violet-300",
        premium: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 font-medium",
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
