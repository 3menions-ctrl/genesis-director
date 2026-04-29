import { cn } from '@/lib/utils';

interface LuminousOrbProps {
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Premium loader — single luminous blue orb with pulsing inner core.
 * Replaces spinners across the app for a unified, ambient feel.
 */
export function LuminousOrb({ size = 96, label, className }: LuminousOrbProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-6', className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
    >
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* Outer halo */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, hsl(210 100% 65% / 0.35) 0%, hsl(210 100% 52% / 0.15) 40%, transparent 70%)',
            filter: 'blur(20px)',
            animation: 'spatial-orb-pulse 2.4s ease-in-out infinite',
          }}
        />
        {/* Inner core */}
        <div
          className="absolute rounded-full"
          style={{
            inset: '28%',
            background:
              'radial-gradient(circle at 35% 35%, hsl(0 0% 100% / 0.95), hsl(210 100% 70%) 40%, hsl(210 100% 45%) 80%)',
            boxShadow:
              '0 0 24px hsl(210 100% 60% / 0.6), inset 0 0 12px hsl(0 0% 100% / 0.4)',
            animation: 'spatial-orb-pulse 2.4s ease-in-out infinite reverse',
          }}
        />
      </div>
      {label && (
        <span className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/50 font-[Instrument_Sans]">
          {label}
        </span>
      )}
    </div>
  );
}