/**
 * CoverFX — the grand, epic, looping animation on the cover (first screen).
 * Over the dark mountain sky: flowing aurora ribbons, a twinkling starfield,
 * periodic shooting stars, and a pulsing alpenglow on the peaks. Screen-blended
 * light over the image; paused under reduced-motion.
 */
import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";

const KEYFRAMES = `
@keyframes cfx-kenburns { from { transform: scale(1); } to { transform: scale(1.12); } }
@keyframes cfx-auroraA { 0%{transform:translateX(-14%) skewX(-8deg) scaleY(1);opacity:.40} 50%{transform:translateX(12%) skewX(5deg) scaleY(1.2);opacity:.72} 100%{transform:translateX(-14%) skewX(-8deg) scaleY(1);opacity:.40} }
@keyframes cfx-auroraB { 0%{transform:translateX(10%) scaleX(1);opacity:.28} 50%{transform:translateX(-10%) scaleX(1.25);opacity:.55} 100%{transform:translateX(10%) scaleX(1);opacity:.28} }
@keyframes cfx-twinkle { 0%,100%{opacity:.12} 50%{opacity:1} }
@keyframes cfx-shoot { 0%{transform:translate(0,0) rotate(20deg);opacity:0} 6%{opacity:1} 20%{opacity:1} 36%,100%{transform:translate(-760px,276px) rotate(20deg);opacity:0} }
@keyframes cfx-glow { 0%,100%{opacity:.22;transform:translateX(-50%) scale(1)} 50%{opacity:.52;transform:translateX(-50%) scale(1.1)} }
@keyframes cfx-mist { 0%{transform:translateX(-7%)} 50%{transform:translateX(7%)} 100%{transform:translateX(-7%)} }
@keyframes cfx-mist2 { 0%{transform:translateX(6%)} 50%{transform:translateX(-6%)} 100%{transform:translateX(6%)} }
`;

export function CoverFX() {
  const reduced = useReducedMotion();
  const stars = useMemo(
    () => Array.from({ length: 62 }).map((_, i) => ({
      left: (i * 53.7) % 100,
      top: (i * 29.3) % 58,
      size: 1 + (i % 3) * 0.7,
      dur: 2.4 + (i % 6) * 0.6,
      delay: -((i * 0.7) % 7),
    })),
    [],
  );
  if (reduced) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{KEYFRAMES}</style>

      {/* aurora ribbons */}
      <div className="absolute -top-[8%] left-0 h-[55%] w-full" style={{ background: "radial-gradient(60% 75% at 38% 50%, hsl(200 95% 62% / 0.55), transparent 62%)", filter: "blur(64px)", mixBlendMode: "screen", animation: "cfx-auroraA 16s ease-in-out infinite" }} />
      <div className="absolute top-0 left-0 h-[50%] w-full" style={{ background: "radial-gradient(55% 65% at 62% 42%, hsl(262 85% 66% / 0.45), transparent 62%)", filter: "blur(72px)", mixBlendMode: "screen", animation: "cfx-auroraB 23s ease-in-out infinite" }} />
      <div className="absolute -top-[4%] left-0 h-[46%] w-full" style={{ background: "radial-gradient(50% 58% at 50% 52%, hsl(155 90% 56% / 0.34), transparent 62%)", filter: "blur(58px)", mixBlendMode: "screen", animation: "cfx-auroraA 19s ease-in-out infinite reverse" }} />

      {/* alpenglow pulse on the peaks */}
      <div className="absolute left-1/2 top-[44%] h-44 w-[64%]" style={{ background: "radial-gradient(ellipse, hsl(26 92% 60% / 0.4), transparent 70%)", filter: "blur(42px)", mixBlendMode: "screen", animation: "cfx-glow 6s ease-in-out infinite" }} />

      {/* drifting mist along the peak line — atmospheric depth */}
      <div className="absolute -left-[12%] top-[52%] h-[16%] w-[124%]" style={{ background: "linear-gradient(90deg, transparent, rgba(214,228,245,0.16) 35%, rgba(214,228,245,0.22) 50%, rgba(214,228,245,0.16) 65%, transparent)", filter: "blur(26px)", mixBlendMode: "screen", animation: "cfx-mist 26s ease-in-out infinite" }} />
      <div className="absolute -left-[12%] top-[60%] h-[14%] w-[124%]" style={{ background: "linear-gradient(90deg, transparent, rgba(200,216,236,0.14) 40%, rgba(200,216,236,0.18) 50%, rgba(200,216,236,0.14) 60%, transparent)", filter: "blur(30px)", mixBlendMode: "screen", animation: "cfx-mist2 34s ease-in-out infinite" }} />

      {/* starfield */}
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-white" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animation: `cfx-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
      ))}

      {/* shooting stars (occasional) */}
      {[0, 1, 2].map((i) => (
        <span key={`s${i}`} className="absolute h-px w-44" style={{ left: `${58 + i * 14}%`, top: `${6 + i * 7}%`, background: "linear-gradient(90deg, transparent, #fff, transparent)", boxShadow: "0 0 10px #fff, 0 0 22px hsl(200 90% 70%)", animation: `cfx-shoot ${8 + i * 2.5}s linear ${i * 4}s infinite` }} />
      ))}
    </div>
  );
}
