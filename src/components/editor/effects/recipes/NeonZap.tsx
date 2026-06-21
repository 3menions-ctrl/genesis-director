/**
 * NeonZap — crackling electric lightning bolt with bloom halo.
 *
 * Procedural zigzag path drawn with SVG strokeDasharray for that
 * "drawn-on" zap feel. Bloom halo via feGaussianBlur. Strikes once,
 * holds, dissolves.
 */
import { useMemo } from "react";
import type { EffectInstance } from "@/lib/editor/effects";

interface Props {
  fx: EffectInstance;
  progress: number;
}

// Tiny seeded RNG so the zap shape is deterministic per fx.seed.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function NeonZap({ fx, progress }: Props) {
  const path = useMemo(() => {
    const rand = mulberry32(fx.seed);
    const cx = fx.positionX * 100;
    const cy = fx.positionY * 100;
    // Build a zigzag from top of frame down through (cx, cy) and out the bottom.
    const segments = 10;
    const pts: string[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = t * 100;
      const drift = (rand() - 0.5) * 18 * (1 - Math.abs(t - 0.5) * 1.4);
      const x = cx + drift;
      pts.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    void cy;
    return pts.join(" ");
  }, [fx.seed, fx.positionX, fx.positionY]);

  // Animation envelope: strike (0..0.2), hold (0.2..0.6), fade (0.6..1.0)
  const strike = progress < 0.2 ? progress / 0.2 : 1;
  const fade   = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
  const flicker = 0.7 + 0.3 * Math.sin(progress * 80);
  const visibleOpacity = fx.opacity * fx.intensity / 100 * strike * fade * flicker;

  const dashLen = 200 * strike;

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
        style={{ opacity: visibleOpacity }}
      >
        <defs>
          <filter id={`nz-glow-${fx.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={2.5 * fx.scale} />
          </filter>
          <filter id={`nz-bloom-${fx.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={6 * fx.scale} />
          </filter>
        </defs>

        {/* Outer bloom halo (soft) */}
        <path
          d={path}
          fill="none"
          stroke={fx.accentColor}
          strokeWidth={4 * fx.scale}
          strokeLinecap="round"
          strokeDasharray="200"
          strokeDashoffset={200 - dashLen}
          filter={`url(#nz-bloom-${fx.id})`}
          opacity="0.6"
        />
        {/* Mid glow */}
        <path
          d={path}
          fill="none"
          stroke={fx.primaryColor}
          strokeWidth={2 * fx.scale}
          strokeLinecap="round"
          strokeDasharray="200"
          strokeDashoffset={200 - dashLen}
          filter={`url(#nz-glow-${fx.id})`}
        />
        {/* Hot core */}
        <path
          d={path}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={0.8 * fx.scale}
          strokeLinecap="round"
          strokeDasharray="200"
          strokeDashoffset={200 - dashLen}
        />
      </svg>
    </div>
  );
}
