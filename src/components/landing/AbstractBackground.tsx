import { forwardRef, memo } from 'react';
import { cn } from '@/lib/utils';
import landingAbstractBg from '@/assets/landing-bg-dubai-full.jpeg';

interface AbstractBackgroundProps {
  className?: string;
}

const AbstractBackground = memo(forwardRef<HTMLDivElement, AbstractBackgroundProps>(
  function AbstractBackground({ className }, ref) {
    return (
      <div
        ref={ref}
        className={cn("absolute inset-0 overflow-hidden bg-background pointer-events-none", className)}
      >
        {/* Full Dubai skyline image — fits the viewport (no zoom, no crop) and anchored to bottom so
            the bright skyline + clouds remain prominent. The dark night sky in the upper half of the
            image blends seamlessly with the page's dark background, eliminating visible letterboxing. */}
        <img
          src={landingAbstractBg}
          alt="Dubai skyline above clouds"
          className="absolute inset-0 h-full w-full object-contain object-bottom select-none"
          draggable={false}
        />
      </div>
    );
  }
));

export default AbstractBackground;
