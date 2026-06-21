/**
 * FrameBreak — the aspect-ratio frame fractures and slides apart.
 *
 * Renders four bars (top / right / bottom / left) that crack apart
 * from the center and slide outward. Works best as a transition
 * between two clips; also usable as a stinger that snaps the frame.
 */
import type { EffectInstance } from "@/lib/editor/effects";

interface Props {
  fx: EffectInstance;
  progress: number;
}

export function FrameBreak({ fx, progress }: Props) {
  // Easing: snap on entry, smooth on exit
  const ease = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  const intensity = fx.intensity / 100;
  const slide = ease * 30 * fx.scale; // percentage units slid outward
  const opacity = fx.opacity * (1 - Math.max(0, (progress - 0.7) / 0.3) * 0.5);

  // Thickness of the breaking frame bars
  const thickness = 4 + intensity * 12;

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ mixBlendMode: fx.blendMode, opacity }}
    >
      {/* Top bar — slides up */}
      <div
        className="absolute left-0 right-0"
        style={{
          top: `-${slide}%`,
          height: `${thickness}%`,
          background: `linear-gradient(180deg, ${fx.primaryColor} 0%, ${fx.accentColor} 100%)`,
          boxShadow: `0 ${4 * intensity}px 16px ${fx.primaryColor}`,
          transform: `rotate(${fx.rotation * 0.05}deg)`,
        }}
      />
      {/* Bottom bar — slides down */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `-${slide}%`,
          height: `${thickness}%`,
          background: `linear-gradient(0deg, ${fx.primaryColor} 0%, ${fx.accentColor} 100%)`,
          boxShadow: `0 -${4 * intensity}px 16px ${fx.primaryColor}`,
          transform: `rotate(${-fx.rotation * 0.05}deg)`,
        }}
      />
      {/* Left bar — slides left */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: `-${slide}%`,
          width: `${thickness}%`,
          background: `linear-gradient(90deg, ${fx.primaryColor} 0%, ${fx.accentColor} 100%)`,
          boxShadow: `${4 * intensity}px 0 16px ${fx.primaryColor}`,
        }}
      />
      {/* Right bar — slides right */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          right: `-${slide}%`,
          width: `${thickness}%`,
          background: `linear-gradient(-90deg, ${fx.primaryColor} 0%, ${fx.accentColor} 100%)`,
          boxShadow: `-${4 * intensity}px 0 16px ${fx.primaryColor}`,
        }}
      />

      {/* Center flash at the start of the break */}
      {progress < 0.2 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${fx.positionX * 100}% ${fx.positionY * 100}%, ${fx.accentColor}, transparent 60%)`,
            opacity: (1 - progress / 0.2) * intensity,
            mixBlendMode: "screen",
          }}
        />
      )}
    </div>
  );
}
