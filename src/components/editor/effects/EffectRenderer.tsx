/**
 * EffectRenderer — dispatch one EffectInstance to its recipe component.
 *
 * For the 6 hero recipes a bespoke renderer is mounted; everything
 * else falls back to GenericEffect — a parameterized radial bloom in
 * the effect's primary color that respects timing, scale, position,
 * blend mode, and opacity. Looks decent on every clip; gets replaced
 * by a real recipe when the bespoke build lands.
 */
import type { EffectInstance } from "@/lib/editor/effects";

import { LightBeam } from "./recipes/LightBeam";
import { NeonZap } from "./recipes/NeonZap";
import { GlassShatter } from "./recipes/GlassShatter";
import { ParticleBurst } from "./recipes/ParticleBurst";
import { SmokeBurst } from "./recipes/SmokeBurst";
import { FrameBreak } from "./recipes/FrameBreak";

interface Props {
  fx: EffectInstance;
  progress: number;
}

export function EffectRenderer({ fx, progress }: Props) {
  switch (fx.recipe) {
    case "light_beam":     return <LightBeam     fx={fx} progress={progress} />;
    case "neon_zap":       return <NeonZap       fx={fx} progress={progress} />;
    case "glass_shatter":  return <GlassShatter  fx={fx} progress={progress} />;
    case "particle_burst": return <ParticleBurst fx={fx} progress={progress} />;
    case "smoke_burst":    return <SmokeBurst    fx={fx} progress={progress} />;
    case "frame_break":    return <FrameBreak    fx={fx} progress={progress} />;
    default:               return <GenericEffect fx={fx} progress={progress} />;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic fallback for recipes without a bespoke renderer yet.
// ─────────────────────────────────────────────────────────────────────────────
function GenericEffect({ fx, progress }: Props) {
  const ease = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  const radius = 20 + ease * 50 * fx.scale;
  const fade = 1 - Math.max(0, (progress - 0.6) / 0.4);
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{
        mixBlendMode: fx.blendMode,
        opacity: fx.opacity * fade * (fx.intensity / 100),
        background: `radial-gradient(circle ${radius}% at ${fx.positionX * 100}% ${fx.positionY * 100}%, ${fx.primaryColor} 0%, ${fx.accentColor} 35%, transparent 70%)`,
      }}
    />
  );
}
