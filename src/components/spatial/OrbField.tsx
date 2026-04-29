import { cn } from '@/lib/utils';

interface OrbFieldProps {
  intensity?: 'subtle' | 'normal' | 'rich';
  className?: string;
}

/**
 * Ambient backdrop — slow-drifting luminous blue orbs.
 * Pure CSS, GPU-cheap, respects prefers-reduced-motion via the spatial-orb-drift class.
 */
export function OrbField({ intensity = 'normal', className }: OrbFieldProps) {
  const orbs =
    intensity === 'subtle' ? 2
    : intensity === 'rich' ? 4
    : 3;

  const config = [
    { top: '-10%', left: '-5%', size: 520, delay: '0s', opacity: 0.45 },
    { top: '40%', right: '-10%', size: 620, delay: '-6s', opacity: 0.35 },
    { bottom: '-15%', left: '20%', size: 480, delay: '-12s', opacity: 0.4 },
    { top: '15%', left: '45%', size: 380, delay: '-3s', opacity: 0.25 },
  ].slice(0, orbs);

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className,
      )}
    >
      {config.map((o, i) => (
        <div
          key={i}
          className="spatial-orb spatial-orb-drift"
          style={{
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
            width: o.size,
            height: o.size,
            opacity: o.opacity,
            animationDelay: o.delay,
          }}
        />
      ))}
      {/* Vignette to keep edges grounded */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, hsl(220 14% 2% / 0.6) 100%)',
        }}
      />
    </div>
  );
}