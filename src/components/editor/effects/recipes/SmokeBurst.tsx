/**
 * SmokeBurst — volumetric smoke cloud erupting outward.
 *
 * Layered radial gradients with feTurbulence-driven displacement for
 * an organic billowing feel. Each puff expands + rises + dissipates.
 */
import { useMemo } from "react";
import type { EffectInstance } from "@/lib/editor/effects";

interface Props {
  fx: EffectInstance;
  progress: number;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Puff {
  angle: number;
  radius: number;       // starting distance from origin
  size: number;
  startDelay: number;
  drift: number;        // sideways drift speed
}

export function SmokeBurst({ fx, progress }: Props) {
  const puffs: Puff[] = useMemo(() => {
    const rand = mulberry32(fx.seed);
    const n = Math.round(8 + (fx.intensity / 100) * 16); // 8..24 puffs
    const out: Puff[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        angle: rand() * Math.PI * 2,
        radius: rand() * 5,
        size: 12 + rand() * 18,
        startDelay: rand() * 0.25,
        drift: (rand() - 0.5) * 0.6,
      });
    }
    return out;
  }, [fx.seed, fx.intensity]);

  const cx = fx.positionX * 100;
  const cy = fx.positionY * 100;

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ mixBlendMode: fx.blendMode, opacity: fx.opacity }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <radialGradient id={`sb-puff-${fx.id}`}>
            <stop offset="0%"   stopColor={fx.primaryColor} stopOpacity="0.75" />
            <stop offset="60%"  stopColor={fx.primaryColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fx.primaryColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`sb-puff-alt-${fx.id}`}>
            <stop offset="0%"   stopColor={fx.accentColor} stopOpacity="0.55" />
            <stop offset="60%"  stopColor={fx.accentColor} stopOpacity="0.20" />
            <stop offset="100%" stopColor={fx.accentColor} stopOpacity="0" />
          </radialGradient>
          <filter id={`sb-turb-${fx.id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={fx.seed % 100} result="t" />
            <feDisplacementMap in="SourceGraphic" in2="t" scale={4 * fx.scale} />
          </filter>
        </defs>

        <g filter={`url(#sb-turb-${fx.id})`}>
          {puffs.map((p, i) => {
            const localT = Math.max(0, (progress - p.startDelay) / (1 - p.startDelay));
            if (localT <= 0) return null;
            // Expand outward + rise
            const dist = localT * 40 * fx.scale;
            const x = cx + Math.cos(p.angle) * (p.radius + dist) + p.drift * localT * 25;
            const y = cy + Math.sin(p.angle) * (p.radius + dist) - localT * 25;
            const r = p.size * fx.scale * (0.4 + localT * 1.4);
            const opacity = 1 - localT;
            return (
              <circle
                key={i}
                cx={x.toFixed(2)} cy={y.toFixed(2)}
                r={r.toFixed(2)}
                fill={i % 3 === 0 ? `url(#sb-puff-alt-${fx.id})` : `url(#sb-puff-${fx.id})`}
                opacity={opacity.toFixed(3)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
