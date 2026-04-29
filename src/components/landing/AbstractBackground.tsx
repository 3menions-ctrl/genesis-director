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
        style={{
          backgroundImage: `url(${landingAbstractBg})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Exact background image — full frame visible, never cropped or zoomed. */}
        <img
          src={landingAbstractBg}
          alt="Dubai skyline above clouds"
          className="absolute inset-0 h-full w-full object-contain object-top select-none opacity-100"
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
