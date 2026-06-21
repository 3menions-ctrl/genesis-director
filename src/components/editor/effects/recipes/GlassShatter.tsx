/**
 * GlassShatter — volumetric glass shards radiating outward.
 *
 * Procedurally generates N shards from the focal point, each a thin
 * triangle that flies outward and tumbles. Strike-and-fly envelope.
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

interface Shard {
  angle: number;     // direction in radians
  speed: number;     // 0..1 multiplier
  rotation: number;  // degrees of spin
  size: number;      // 0.5..2
  hueShift: number;  // small color variation
  startDelay: number;// 0..0.3 of progress
}

export function GlassShatter({ fx, progress }: Props) {
  const shards: Shard[] = useMemo(() => {
    const rand = mulberry32(fx.seed);
    const n = Math.round(12 + (fx.intensity / 100) * 24); // 12..36 shards
    const out: Shard[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      out.push({
        angle,
        speed: 0.6 + rand() * 0.8,
        rotation: (rand() - 0.5) * 720,
        size: 0.6 + rand() * 1.4,
        hueShift: (rand() - 0.5) * 30,
        startDelay: rand() * 0.2,
      });
    }
    return out;
  }, [fx.seed, fx.intensity]);

  const fade = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

  const cx = fx.positionX * 100;
  const cy = fx.positionY * 100;

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ mixBlendMode: fx.blendMode, opacity: fx.opacity * fade }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <filter id={`gs-sheen-${fx.id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={0.5 * fx.scale} />
          </filter>
        </defs>

        {/* Initial flash at impact */}
        {progress < 0.15 && (
          <circle
            cx={cx} cy={cy}
            r={(8 + progress * 60) * fx.scale}
            fill="#FFFFFF"
            opacity={(1 - progress / 0.15) * 0.9}
          />
        )}

        {/* Shards */}
        {shards.map((s, i) => {
          const localT = Math.max(0, (progress - s.startDelay) / (1 - s.startDelay));
          if (localT <= 0) return null;
          const dist = localT * s.speed * 80 * fx.scale;
          const ex = cx + Math.cos(s.angle) * dist;
          const ey = cy + Math.sin(s.angle) * dist + localT * localT * 25; // gravity
          const rot = (s.rotation * localT + fx.rotation).toFixed(1);
          const w = 2 * s.size;
          const h = 5 * s.size;
          const opacity = (1 - localT * 0.7);
          return (
            <g
              key={i}
              transform={`translate(${ex.toFixed(2)} ${ey.toFixed(2)}) rotate(${rot})`}
              opacity={opacity}
              filter={`url(#gs-sheen-${fx.id})`}
            >
              {/* Shard body — thin triangle */}
              <polygon
                points={`0,${-h} ${w},${h * 0.5} ${-w * 0.5},${h * 0.5}`}
                fill={fx.primaryColor}
                stroke={fx.accentColor}
                strokeWidth="0.3"
                opacity="0.85"
              />
              {/* Specular highlight */}
              <polygon
                points={`0,${-h * 0.9} ${w * 0.5},${0} ${-w * 0.2},${0}`}
                fill="#FFFFFF"
                opacity="0.5"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
