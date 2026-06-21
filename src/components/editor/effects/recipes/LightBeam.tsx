/**
 * LightBeam — sustained volumetric god ray.
 *
 * Animated SVG with feGaussianBlur + linear gradient. Lives across the
 * full duration of the effect; rotates and breathes subtly.
 */
import type { EffectInstance } from "@/lib/editor/effects";

interface Props {
  fx: EffectInstance;
  /** 0..1 progress through the effect window. */
  progress: number;
}

export function LightBeam({ fx, progress }: Props) {
  const intensity = fx.intensity / 100;
  const opacity = fx.opacity * (0.7 + 0.3 * Math.sin(progress * Math.PI * 2)) * intensity;
  const rotation = fx.rotation + progress * 4; // gentle drift

  // The beam is a wide rotated rectangle filled with a gradient that
  // fades out at the edges. Two stacked beams (one wide, one tight)
  // approximate volumetric falloff.
  const cx = fx.positionX * 100;
  const cy = fx.positionY * 100;

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ mixBlendMode: fx.blendMode }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{ opacity }}
      >
        <defs>
          <linearGradient id={`lb-grad-${fx.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={fx.primaryColor} stopOpacity="0" />
            <stop offset="45%"  stopColor={fx.primaryColor} stopOpacity="0.85" />
            <stop offset="55%"  stopColor={fx.accentColor}  stopOpacity="0.95" />
            <stop offset="100%" stopColor={fx.primaryColor} stopOpacity="0" />
          </linearGradient>
          <filter id={`lb-blur-${fx.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={6 * fx.scale} />
          </filter>
        </defs>

        <g
          transform={`translate(${cx} ${cy}) rotate(${rotation}) translate(-${cx} -${cy})`}
          filter={`url(#lb-blur-${fx.id})`}
        >
          {/* Wide soft beam */}
          <rect
            x="-50" y={cy - 40 * fx.scale}
            width="200" height={80 * fx.scale}
            fill={`url(#lb-grad-${fx.id})`}
          />
          {/* Tight core beam */}
          <rect
            x="-50" y={cy - 12 * fx.scale}
            width="200" height={24 * fx.scale}
            fill={`url(#lb-grad-${fx.id})`}
            opacity="0.85"
          />
        </g>
      </svg>
    </div>
  );
}
