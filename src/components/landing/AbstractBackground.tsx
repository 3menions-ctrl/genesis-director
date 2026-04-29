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
        {/* Blurred ambient fill — eliminates letterbox bars without cropping the main image. */}
        <img
          src={landingAbstractBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center select-none scale-110"
          style={{ filter: 'blur(60px) brightness(0.5) saturate(1.1)' }}
          draggable={false}
        />
        {/* Full image fits inside the viewport — never cropped or zoomed. Page content scrolls over it. */}
        <img
          src={landingAbstractBg}
          alt="Dubai skyline above clouds"
          className="absolute inset-0 h-full w-full object-contain object-center select-none"
          draggable={false}
        />

        {/* Soft vignette — gentle edge falloff only */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 72%, rgba(0,0,0,0.12) 100%)',
          }}
        />
      </div>
    );
  }
));

export default AbstractBackground;
