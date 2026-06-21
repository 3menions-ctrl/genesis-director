/**
 * StudioBackdrop — the atmosphere behind the Creation Studio.
 *
 * Design intent (what reads "premium + trustworthy" for a pro creative tool —
 * the Linear / Runway / Figma school):
 *   · Restraint — one deep, near-black base and a SINGLE restrained accent
 *     glow. Multiple colourful blooms read consumer; calm reads professional.
 *   · Depth without distraction — a soft top glow + an edge vignette give the
 *     room depth so the canvas floats, but the eye still rests on the work.
 *   · Tactility — fine film grain removes the flat "digital" look so the
 *     surface feels crafted, not cheap.
 *   · Structure / trust — a barely-there technical dot-grid (faded toward the
 *     centre) signals precision and engineering, like a drafting table.
 *   · Stillness — no motion. Movement is flashy; a still room is confident.
 *
 * Fixed, full-viewport; sits above the shared SpineBackdrop and below content.
 */
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
  );

export function StudioBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* the studio set — a real sound-stage photo, heavily graded so it stays
          subordinate to the work; gives the room a true place to live in */}
      <div className="absolute inset-0" style={{ backgroundImage: "url(/cinema-assets/studio-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%", filter: "saturate(0.62) brightness(0.4) contrast(1.04)" }} />
      {/* deep, slightly-cool near-black tint over the set */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(125% 95% at 50% -8%, rgba(12,16,25,0.60) 0%, rgba(8,9,14,0.80) 46%, rgba(5,6,8,0.92) 100%)" }} />
      {/* single restrained accent glow, anchored at the top */}
      <div
        className="absolute left-1/2 top-[-22%] h-[58vw] w-[86vw] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, hsl(var(--accent) / 0.12), transparent 70%)", filter: "blur(90px)" }}
      />
      {/* faint technical dot-grid, faded toward the centre */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.028) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          WebkitMaskImage: "radial-gradient(135% 110% at 50% 0%, #000 22%, transparent 78%)",
          maskImage: "radial-gradient(135% 110% at 50% 0%, #000 22%, transparent 78%)",
        }}
      />
      {/* fine grain for premium tactility */}
      <div className="absolute inset-0 opacity-[0.045] mix-blend-overlay" style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "160px 160px" }} />
      {/* edge vignette — pulls focus to the canvas */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(125% 105% at 50% 42%, transparent 52%, rgba(3,4,6,0.72) 100%)" }} />
    </div>
  );
}
