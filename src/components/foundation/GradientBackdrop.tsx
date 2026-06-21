/**
 * GradientBackdrop — a fixed, full-viewport premium gradient backdrop with a
 * couple of soft colour blooms, fine grain and an edge vignette. One component,
 * a few tonal variants, so sibling pages can share the exact same look.
 *
 * Sits above the shared SpineBackdrop (z-0) and below page content.
 */
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
  );

type Tone = "violet" | "skyblue" | "grey" | "orange";

const TONES: Record<Tone, { base: string; bloomTop: string; bloomBottom: string; vignette: string; gloss?: string }> = {
  violet: {
    // Deep, glossy dark violet — richer base + a bright diagonal sheen so it
    // reads polished/shiny, not flat.
    base: "radial-gradient(125% 95% at 50% -8%, hsl(282 60% 18%) 0%, hsl(277 54% 10%) 46%, hsl(270 50% 5%) 100%)",
    bloomTop: "radial-gradient(closest-side, hsla(286,85%,64%,0.34), transparent 70%)",
    bloomBottom: "radial-gradient(circle, hsla(262,85%,58%,0.24), transparent 70%)",
    vignette: "radial-gradient(125% 105% at 50% 42%, transparent 54%, rgba(8,3,12,0.74) 100%)",
    gloss: "linear-gradient(116deg, transparent 24%, hsla(288,90%,80%,0.10) 45%, hsla(288,90%,80%,0.03) 54%, transparent 66%)",
  },
  skyblue: {
    base: "radial-gradient(125% 95% at 50% -8%, hsl(205 80% 20%) 0%, hsl(210 72% 11%) 44%, hsl(216 60% 5%) 100%)",
    bloomTop: "radial-gradient(closest-side, hsla(200,95%,68%,0.30), transparent 70%)",
    bloomBottom: "radial-gradient(circle, hsla(190,90%,62%,0.20), transparent 70%)",
    vignette: "radial-gradient(125% 105% at 50% 42%, transparent 55%, rgba(3,7,12,0.72) 100%)",
  },
  orange: {
    base: "radial-gradient(125% 95% at 50% -8%, hsl(24 70% 16%) 0%, hsl(20 62% 9%) 46%, hsl(22 50% 4.5%) 100%)",
    bloomTop: "radial-gradient(closest-side, hsla(28,95%,56%,0.30), transparent 70%)",
    bloomBottom: "radial-gradient(circle, hsla(14,90%,52%,0.22), transparent 70%)",
    vignette: "radial-gradient(125% 105% at 50% 42%, transparent 54%, rgba(10,5,3,0.72) 100%)",
  },
  grey: {
    base: "linear-gradient(162deg, hsl(220 7% 17%) 0%, hsl(220 6% 10%) 46%, hsl(220 7% 5%) 100%)",
    bloomTop: "radial-gradient(closest-side, hsla(0,0%,100%,0.10), transparent 70%)",
    bloomBottom: "radial-gradient(circle, hsla(220,12%,55%,0.12), transparent 70%)",
    vignette: "radial-gradient(125% 105% at 50% 42%, transparent 52%, rgba(4,5,7,0.74) 100%)",
    // A glossy diagonal sheen for the "rich glossy" read.
    gloss: "linear-gradient(118deg, transparent 26%, rgba(255,255,255,0.07) 46%, rgba(255,255,255,0.02) 54%, transparent 64%)",
  },
};

export function GradientBackdrop({ tone = "violet" }: { tone?: Tone }) {
  const t = TONES[tone];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: t.base }} />
      {t.gloss && <div className="absolute inset-0" style={{ background: t.gloss }} />}
      <div
        className="absolute left-1/2 top-[-20%] h-[60vw] w-[88vw] -translate-x-1/2 rounded-full"
        style={{ background: t.bloomTop, filter: "blur(100px)" }}
      />
      <div
        className="absolute -bottom-1/4 -left-1/4 h-[55vw] w-[55vw] rounded-full"
        style={{ background: t.bloomBottom, filter: "blur(120px)" }}
      />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "160px 160px" }} />
      <div className="absolute inset-0" style={{ background: t.vignette }} />
    </div>
  );
}
