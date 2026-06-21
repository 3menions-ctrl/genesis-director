/**
 * BusinessBackdrop — the atmospheric layer for the /business module.
 *
 * A tinted variant of SpineBackdrop (same anatomy: deep radial base, two
 * corner blooms, a halo, a star field, a vignette and fractal grain) that
 * accepts one of five dark "tones" so different sections of the business app
 * carry their own colour while keeping the identical premium, near-black feel.
 *
 * Tone is chosen per route by nav section (see toneForBusinessPath).
 */
export type BizTone = "blue" | "brown" | "green" | "grey" | "violet";

interface Tone {
  /** Four "H S% L%" stops for the radial base (light → dark). */
  base: [string, string, string, string];
  /** "H S% L%" hues for the two corner blooms + the halo. */
  b1: string;
  b2: string;
  halo: string;
}

const TONES: Record<BizTone, Tone> = {
  // The current, loved blue → near-black.
  blue: {
    base: ["218 60% 9%", "220 50% 5%", "220 40% 2.5%", "222 50% 1.5%"],
    b1: "212 92% 50%", b2: "236 80% 45%", halo: "195 95% 55%",
  },
  // Warm, rich sepia/amber — the editor's register.
  brown: {
    base: ["28 42% 8.5%", "26 38% 4.5%", "24 32% 2.5%", "24 38% 1.5%"],
    b1: "32 78% 46%", b2: "16 66% 40%", halo: "40 82% 52%",
  },
  // Deep forest / emerald.
  green: {
    base: ["158 44% 7.5%", "156 38% 4.2%", "155 32% 2.3%", "156 40% 1.4%"],
    b1: "150 72% 40%", b2: "172 60% 36%", halo: "158 78% 46%",
  },
  // Neutral charcoal / slate — desaturated blooms keep it grey.
  grey: {
    base: ["220 11% 9.5%", "220 9% 5.5%", "220 7% 3%", "220 9% 1.8%"],
    b1: "215 18% 52%", b2: "230 16% 46%", halo: "210 22% 58%",
  },
  // Deep violet → magenta.
  violet: {
    base: ["265 50% 9.5%", "265 44% 5%", "266 38% 2.8%", "268 44% 1.7%"],
    b1: "270 80% 52%", b2: "292 68% 46%", halo: "280 82% 58%",
  },
};

// ── Route → tone (by nav section), so an app area reads as one atmosphere ────
const SECTION_TONE: Record<string, BizTone> = {
  // Operate — the work, on the loved blue.
  "": "blue", create: "blue", editor: "blue", projects: "blue", assets: "blue",
  avatars: "blue", environments: "blue", templates: "blue", learning: "blue",
  // Govern — green.
  team: "green", brand: "green", audit: "green", permissions: "green", approvals: "green",
  // Optimize — warm brown (money & telemetry).
  billing: "brown", credits: "brown", analytics: "brown", reports: "brown",
  // Extend — violet.
  integrations: "violet", api: "violet", notifications: "violet",
  // Settings — grey.
  settings: "grey", general: "grey", security: "grey", danger: "grey",
};

export function toneForBusinessPath(pathname: string): BizTone {
  const seg = pathname.replace(/^\/business\/?/, "").split("/")[0] ?? "";
  return SECTION_TONE[seg] ?? "blue";
}

const STARS =
  "radial-gradient(circle at 12% 22%, hsl(0 0% 100% / 0.5) 0.5px, transparent 1px), radial-gradient(circle at 68% 41%, hsl(210 100% 90% / 0.45) 0.5px, transparent 1px), radial-gradient(circle at 31% 78%, hsl(0 0% 100% / 0.4) 0.5px, transparent 1px), radial-gradient(circle at 82% 88%, hsl(0 0% 100% / 0.35) 0.5px, transparent 1px), radial-gradient(circle at 50% 50%, hsl(195 100% 85% / 0.4) 0.5px, transparent 1px), radial-gradient(circle at 89% 14%, hsl(0 0% 100% / 0.45) 0.5px, transparent 1px), radial-gradient(circle at 4% 60%, hsl(220 100% 90% / 0.35) 0.5px, transparent 1px)";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06   0 0 0 0 0.08   0 0 0 0 0.12   0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function BusinessBackdrop({ tone = "blue" }: { tone?: BizTone }) {
  const t = TONES[tone];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base — deep tone fading to near-black. */}
      <div
        className="absolute inset-0 transition-[background] duration-500"
        style={{
          background: `radial-gradient(ellipse 110% 80% at 50% 0%, hsl(${t.base[0]}) 0%, hsl(${t.base[1]}) 35%, hsl(${t.base[2]}) 75%, hsl(${t.base[3]}) 100%)`,
        }}
      />
      {/* Upper-left bloom. */}
      <div
        className="absolute h-[55vw] w-[55vw] rounded-full"
        style={{ top: "-12vw", left: "-12vw", filter: "blur(80px)", background: `radial-gradient(circle, hsl(${t.b1} / 0.22) 0%, hsl(${t.b1} / 0.08) 35%, transparent 70%)` }}
      />
      {/* Lower-right bloom. */}
      <div
        className="absolute h-[60vw] w-[60vw] rounded-full"
        style={{ bottom: "-18vw", right: "-14vw", filter: "blur(90px)", background: `radial-gradient(circle, hsl(${t.b2} / 0.20) 0%, hsl(${t.b2} / 0.06) 35%, transparent 70%)` }}
      />
      {/* Top-right halo. */}
      <div
        className="absolute h-[28vw] w-[28vw] rounded-full"
        style={{ top: "8vh", right: "10vw", filter: "blur(60px)", background: `radial-gradient(circle, hsl(${t.halo} / 0.10) 0%, transparent 65%)` }}
      />
      {/* Star/dust field. */}
      <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: STARS, backgroundSize: "100% 100%" }} />
      {/* Vignette. */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse 70% 50% at 50% 50%, transparent 0%, transparent 50%, hsl(${t.base[3]} / 0.55) 100%)` }}
      />
      {/* Fractal grain. */}
      <div className="absolute inset-0 mix-blend-overlay opacity-[0.22]" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
