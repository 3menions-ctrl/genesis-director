import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center group/slider",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-[hsla(0,0%,100%,0.08)] transition-colors group-hover/slider:bg-[hsla(0,0%,100%,0.12)]">
      <SliderPrimitive.Range
        className="absolute h-full rounded-full transition-colors"
        style={{
          background: "linear-gradient(90deg, hsl(215, 100%, 50%), hsl(215, 100%, 60%))",
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block h-3.5 w-3.5 rounded-full border-2 bg-white transition-all duration-150",
        "shadow-[0_1px_6px_hsla(215,100%,50%,0.3)]",
        "border-[hsl(215,100%,55%)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsla(215,100%,50%,0.4)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
        "hover:scale-125 hover:shadow-[0_0_12px_hsla(215,100%,50%,0.45)]",
        "active:scale-110",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
