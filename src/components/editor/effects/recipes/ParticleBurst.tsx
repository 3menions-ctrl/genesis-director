/**
 * ParticleBurst — radial explosion of soft glowing particles.
 *
 * N particles fly outward from the focal point with random trajectories
 * and gentle gravity. Each particle has a soft circle gradient (no
 * texture) so it stays light and stylized.
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

interface Particle {
  angle: number;
  speed: number;
  size: number;
  hueT: number;       // 0 = primary, 1 = accent
  startDelay: number;
  twinkleFreq: number;
}

export function ParticleBurst({ fx, progress }: Props) {
  const particles: Particle[] = useMemo(() => {
    const rand = mulberry32(fx.seed);
    const n = Math.round(30 + (fx.intensity / 100) * 90); // 30..120
    const out: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const angle = rand() * Math.PI * 2;
      out.push({
        angle,
        speed: 0.3 + rand() * 1.2,
        size: 0.5 + rand() * 2.2,
        hueT: rand(),
        startDelay: rand() * 0.15,
        twinkleFreq: 4 + rand() * 8,
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
          <radialGradient id={`pb-soft-${fx.id}`}>
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%"  stopColor={fx.primaryColor} stopOpacity="0.65" />
            <stop offset="100%" stopColor={fx.primaryColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`pb-accent-${fx.id}`}>
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%"  stopColor={fx.accentColor} stopOpacity="0.65" />
            <stop offset="100%" stopColor={fx.accentColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Initial flash */}
        {progress < 0.12 && (
          <circle
            cx={cx} cy={cy}
            r={(6 + progress * 80) * fx.scale}
            fill="#FFFFFF"
            opacity={(1 - progress / 0.12) * 0.85}
          />
        )}

        {/* Particles */}
        {particles.map((p, i) => {
          const localT = Math.max(0, (progress - p.startDelay) / (1 - p.startDelay));
          if (localT <= 0) return null;
          const dist = localT * p.speed * 70 * fx.scale;
          const px = cx + Math.cos(p.angle) * dist;
          const py = cy + Math.sin(p.angle) * dist + localT * localT * 18;
          const fade = 1 - localT * 0.85;
          const twinkle = 0.6 + 0.4 * Math.sin(localT * p.twinkleFreq * 10);
          const r = p.size * fx.scale * (0.6 + localT * 0.4);
          return (
            <circle
              key={i}
              cx={px.toFixed(2)} cy={py.toFixed(2)}
              r={r.toFixed(2)}
              fill={p.hueT < 0.6 ? `url(#pb-soft-${fx.id})` : `url(#pb-accent-${fx.id})`}
              opacity={(fade * twinkle).toFixed(3)}
            />
          );
        })}
      </svg>
    </div>
  );
}
