/**
 * LUT library — Deno mirror of src/lib/editor/lut-library.ts.
 *
 * 30 cinematic looks authored as parameter recipes. Each look targets a
 * recognizable cinematic feel: a film stock (Kodak 2383, Fuji Eterna),
 * an era (60s, 80s, Y2K), a mood (noir, dreamy, neon), or a director's
 * signature palette (Roma, Wong Kar-wai, Bladerunner).
 *
 * IMPORTANT: the LUT data here MUST stay identical to the frontend
 * copy. If you tune a LUT in src/lib/editor/lut-library.ts, copy the
 * same row here in the same commit.
 */
import type { LutLook } from "./color-grade.ts";

export const LUT_LIBRARY: LutLook[] = [
  // ─── FILM STOCKS (8) ──────────────────────────────────────────────
  {
    id: "kodak-2383",
    name: "Kodak 2383",
    description: "The print stock — warm highlights, deep blacks, the look of a real cinema projection.",
    category: "film-stock",
    swatch: { primary: "#F4C77A", secondary: "#3A2418", accent: "#D97757" },
    wheel: {
      lift:  { r: -0.02, g: -0.02, b: -0.03 },
      gamma: { r:  0.05, g:  0.02, b: -0.03 },
      gain:  { r:  0.03, g:  0.01, b: -0.05 },
    },
    saturation:  10, contrast: 18, vibrance: 8, temperature: 12, tint: -3,
    grain: 35, halation: 20, vignette: 15, softness: 8,
    notes: "Standard for theatrical release prints. Skin tones glow.",
    year: 2002,
  },
  {
    id: "fuji-eterna",
    name: "Fuji Eterna 500T",
    description: "Cool tungsten stock — desaturated, slightly cyan shadows, gentle highlights.",
    category: "film-stock",
    swatch: { primary: "#A8B5A0", secondary: "#1B2620", accent: "#C8DEE8" },
    wheel: {
      lift:  { r: -0.04, g: -0.01, b:  0.03 },
      gamma: { r: -0.02, g:  0.00, b:  0.02 },
      gain:  { r:  0.00, g:  0.01, b:  0.02 },
    },
    saturation: -12, contrast: 8, vibrance: -5, temperature: -18, tint: 5,
    grain: 25, halation: 5, vignette: 8, softness: 12,
    notes: "Used on No Country for Old Men, Children of Men. Calm, observed.",
    year: 2007,
  },
  {
    id: "kodak-vision3-500t",
    name: "Vision3 500T",
    description: "Modern Kodak tungsten — clean highlights, low grain, neutral skintones.",
    category: "film-stock",
    swatch: { primary: "#E8DCC2", secondary: "#2A2520", accent: "#A8744A" },
    wheel: {
      lift:  { r: -0.01, g: -0.01, b: -0.02 },
      gamma: { r:  0.02, g:  0.01, b:  0.00 },
      gain:  { r:  0.01, g:  0.01, b: -0.01 },
    },
    saturation: 4, contrast: 12, vibrance: 6, temperature: 5, tint: 0,
    grain: 15, halation: 8, vignette: 5, softness: 5,
    notes: "Industry-standard digital intermediate base. Reliable.",
    year: 2017,
  },
  {
    id: "cinestill-800t",
    name: "Cinestill 800T",
    description: "Tungsten film with halation — neon signs bloom red, cool shadows.",
    category: "film-stock",
    swatch: { primary: "#FF6B35", secondary: "#1A1A2E", accent: "#00CED1" },
    wheel: {
      lift:  { r:  0.02, g: -0.02, b:  0.05 },
      gamma: { r:  0.04, g: -0.01, b:  0.02 },
      gain:  { r:  0.06, g:  0.02, b: -0.02 },
    },
    saturation: 18, contrast: 22, vibrance: 12, temperature: -8, tint: -4,
    grain: 45, halation: 75, vignette: 12, softness: 10,
    notes: "The neon-night film. Halation on every highlight.",
    year: 2018,
  },
  {
    id: "ektachrome-100",
    name: "Ektachrome 100",
    description: "Punchy slide film — saturated greens, cool blues, daylight balanced.",
    category: "film-stock",
    swatch: { primary: "#4A8B3A", secondary: "#1B3A52", accent: "#F4D88A" },
    wheel: {
      lift:  { r: -0.03, g: -0.01, b:  0.02 },
      gamma: { r: -0.02, g:  0.02, b:  0.00 },
      gain:  { r:  0.00, g:  0.04, b:  0.02 },
    },
    saturation: 28, contrast: 22, vibrance: 18, temperature: -5, tint: 8,
    grain: 12, halation: 5, vignette: 6, softness: 4,
    notes: "Wes Anderson territory. Color you can taste.",
    year: 1996,
  },
  {
    id: "portra-400",
    name: "Portra 400",
    description: "Portrait negative — flattering skin, soft contrast, golden midtones.",
    category: "film-stock",
    swatch: { primary: "#F4C77A", secondary: "#3D2817", accent: "#D4A574" },
    wheel: {
      lift:  { r:  0.02, g:  0.00, b: -0.02 },
      gamma: { r:  0.05, g:  0.02, b: -0.04 },
      gain:  { r:  0.04, g:  0.02, b: -0.03 },
    },
    saturation: 8, contrast: 5, vibrance: 12, temperature: 18, tint: -2,
    grain: 20, halation: 10, vignette: 8, softness: 12,
    notes: "Wedding photographers swear by it. Forgiving of every skintone.",
    year: 1998,
  },
  {
    id: "agfa-vista",
    name: "Agfa Vista 200",
    description: "Discontinued consumer film — punchy reds, warm overall, slight cyan blue.",
    category: "film-stock",
    swatch: { primary: "#E94560", secondary: "#08D9D6", accent: "#FFFFFF" },
    wheel: {
      lift:  { r:  0.04, g: -0.01, b: -0.01 },
      gamma: { r:  0.06, g:  0.00, b: -0.02 },
      gain:  { r:  0.05, g:  0.01, b: -0.01 },
    },
    saturation: 22, contrast: 18, vibrance: 18, temperature: 10, tint: -4,
    grain: 30, halation: 15, vignette: 10, softness: 8,
    notes: "Lost forever in 2018. The Eurosummer look.",
    year: 1980,
  },
  {
    id: "ilford-hp5",
    name: "Ilford HP5",
    description: "B&W workhorse — deep blacks, soft highlights, beautiful grain.",
    category: "film-stock",
    swatch: { primary: "#1A1A1A", secondary: "#8A8A8A", accent: "#F0F0F0" },
    wheel: {
      lift:  { r: -0.04, g: -0.04, b: -0.04 },
      gamma: { r:  0.00, g:  0.00, b:  0.00 },
      gain:  { r:  0.02, g:  0.02, b:  0.02 },
    },
    saturation: -100, contrast: 28, vibrance: 0, temperature: 0, tint: 0,
    grain: 60, halation: 0, vignette: 18, softness: 8,
    notes: "Cartier-Bresson's film. Push it three stops and pray.",
    year: 1976,
  },

  // ─── DIRECTORS & FILMS (7) ────────────────────────────────────────
  {
    id: "wong-kar-wai",
    name: "Wong Kar-wai",
    description: "In the Mood for Love — sumptuous reds, deep greens, neon in rain.",
    category: "director",
    swatch: { primary: "#B22222", secondary: "#0F3D2E", accent: "#FFD700" },
    wheel: {
      lift:  { r:  0.05, g: -0.02, b: -0.04 },
      gamma: { r:  0.08, g:  0.00, b: -0.05 },
      gain:  { r:  0.06, g: -0.02, b: -0.04 },
    },
    saturation: 25, contrast: 24, vibrance: 14, temperature: 22, tint: -8,
    grain: 35, halation: 35, vignette: 25, softness: 18,
    notes: "Step-printing, slow-mo, glow. Christopher Doyle's hand.",
    year: 2000,
  },
  {
    id: "roma",
    name: "Roma (Cuarón)",
    description: "Silvery B&W — clean grays, controlled blacks, soft shoulder.",
    category: "director",
    swatch: { primary: "#9CA3AF", secondary: "#1F2937", accent: "#E5E7EB" },
    wheel: {
      lift:  { r: -0.02, g: -0.02, b: -0.01 },
      gamma: { r:  0.00, g:  0.00, b:  0.01 },
      gain:  { r:  0.01, g:  0.01, b:  0.02 },
    },
    saturation: -100, contrast: 16, vibrance: 0, temperature: -3, tint: 1,
    grain: 10, halation: 0, vignette: 8, softness: 6,
    notes: "ALEXA 65 monochrome. Modern, not nostalgic.",
    year: 2018,
  },
  {
    id: "bladerunner-2049",
    name: "Bladerunner 2049",
    description: "Deakins amber + teal — dust haze, orange sandstorms, cold interiors.",
    category: "director",
    swatch: { primary: "#FF8C00", secondary: "#2A4A52", accent: "#1A1A1A" },
    wheel: {
      lift:  { r: -0.01, g: -0.03, b: -0.05 },
      gamma: { r:  0.06, g: -0.02, b: -0.05 },
      gain:  { r:  0.08, g:  0.02, b: -0.06 },
    },
    saturation: 5, contrast: 32, vibrance: 8, temperature: 28, tint: -6,
    grain: 15, halation: 18, vignette: 30, softness: 5,
    notes: "Push amber + push teal until they fight for the frame.",
    year: 2017,
  },
  {
    id: "moonlight",
    name: "Moonlight",
    description: "James Laxton's chrome blue + bronze skin — intimate, lit from beneath.",
    category: "director",
    swatch: { primary: "#1E3A5F", secondary: "#FF9D6C", accent: "#FBBF24" },
    wheel: {
      lift:  { r: -0.02, g: -0.01, b:  0.04 },
      gamma: { r:  0.04, g:  0.02, b:  0.01 },
      gain:  { r:  0.04, g:  0.03, b: -0.02 },
    },
    saturation: 18, contrast: 22, vibrance: 12, temperature: 10, tint: -3,
    grain: 18, halation: 15, vignette: 22, softness: 8,
    notes: "Black skin lit with intention. Saturated blues against bronze.",
    year: 2016,
  },
  {
    id: "anderson-budapest",
    name: "Grand Budapest Hotel",
    description: "Wes Anderson candy palette — pinks, mauves, mustard yellows.",
    category: "director",
    swatch: { primary: "#FFB7C5", secondary: "#FBBF24", accent: "#7C3AED" },
    wheel: {
      lift:  { r:  0.04, g:  0.02, b:  0.03 },
      gamma: { r:  0.05, g:  0.04, b:  0.02 },
      gain:  { r:  0.05, g:  0.05, b:  0.02 },
    },
    saturation: 32, contrast: 14, vibrance: 22, temperature: 8, tint: 5,
    grain: 8, halation: 5, vignette: 5, softness: 5,
    notes: "Symmetry, centered subjects, palette curated to madness.",
    year: 2014,
  },
  {
    id: "fincher-cold",
    name: "Fincher Cold",
    description: "Se7en + Mindhunter — desaturated, green-pushed shadows, sodium streetlamps.",
    category: "director",
    swatch: { primary: "#3D4A3D", secondary: "#1A1A1A", accent: "#FFB347" },
    wheel: {
      lift:  { r: -0.03, g: -0.01, b: -0.04 },
      gamma: { r: -0.02, g:  0.02, b: -0.04 },
      gain:  { r:  0.02, g:  0.04, b: -0.02 },
    },
    saturation: -25, contrast: 28, vibrance: -10, temperature: -8, tint: 12,
    grain: 12, halation: 10, vignette: 18, softness: 5,
    notes: "Forensic. The light always feels harvested, never given.",
    year: 1995,
  },
  {
    id: "kar-wai-fallen",
    name: "Fallen Angels (Doyle)",
    description: "Wide-angle motion blur, blue-green neon, smeared yellows.",
    category: "director",
    swatch: { primary: "#00FFD1", secondary: "#FF1493", accent: "#FFD700" },
    wheel: {
      lift:  { r:  0.02, g:  0.01, b:  0.05 },
      gamma: { r:  0.03, g:  0.05, b:  0.02 },
      gain:  { r:  0.05, g:  0.06, b:  0.04 },
    },
    saturation: 38, contrast: 28, vibrance: 18, temperature: -5, tint: 12,
    grain: 28, halation: 45, vignette: 22, softness: 14,
    notes: "Christopher Doyle handheld. Permission to blur reality.",
    year: 1995,
  },

  // ─── ERAS (6) ─────────────────────────────────────────────────────
  {
    id: "70s-warm",
    name: "1970s · New Hollywood",
    description: "Faded primaries, soft contrast, warm rolloff — the look of Polaroids.",
    category: "era",
    swatch: { primary: "#D97757", secondary: "#3A2418", accent: "#F4D88A" },
    wheel: {
      lift:  { r:  0.05, g:  0.02, b: -0.02 },
      gamma: { r:  0.04, g:  0.02, b: -0.04 },
      gain:  { r:  0.02, g:  0.01, b: -0.05 },
    },
    saturation: -8, contrast: 8, vibrance: 5, temperature: 22, tint: -5,
    grain: 32, halation: 18, vignette: 22, softness: 18,
    notes: "Taxi Driver, Annie Hall, Apocalypse Now opening reel.",
    year: 1975,
  },
  {
    id: "80s-neon",
    name: "1980s · Neon",
    description: "VHS chroma bleed, hot pink + cyan, scanline saturation.",
    category: "era",
    swatch: { primary: "#FF1493", secondary: "#00FFFF", accent: "#FFD700" },
    wheel: {
      lift:  { r:  0.03, g: -0.01, b:  0.04 },
      gamma: { r:  0.05, g:  0.02, b:  0.04 },
      gain:  { r:  0.06, g:  0.03, b:  0.04 },
    },
    saturation: 38, contrast: 22, vibrance: 22, temperature: 0, tint: -8,
    grain: 35, halation: 32, vignette: 18, softness: 12,
    notes: "Miami Vice, Drive, every synthwave music video.",
    year: 1985,
  },
  {
    id: "90s-grunge",
    name: "1990s · Grunge",
    description: "Desaturated greens, lifted blacks, the look of a stolen Camcorder.",
    category: "era",
    swatch: { primary: "#556B2F", secondary: "#3D3D3D", accent: "#A89368" },
    wheel: {
      lift:  { r:  0.04, g:  0.04, b:  0.03 },
      gamma: { r: -0.02, g:  0.00, b: -0.04 },
      gain:  { r:  0.00, g:  0.02, b: -0.02 },
    },
    saturation: -22, contrast: 6, vibrance: -8, temperature: -8, tint: 8,
    grain: 28, halation: 8, vignette: 15, softness: 14,
    notes: "Nirvana videos, Kids, early Spike Jonze.",
    year: 1994,
  },
  {
    id: "y2k-digital",
    name: "Y2K · Digital",
    description: "Early-2000s digital — cool blues, harsh contrast, plastic skin.",
    category: "era",
    swatch: { primary: "#3B82F6", secondary: "#1F2937", accent: "#E5E7EB" },
    wheel: {
      lift:  { r: -0.04, g: -0.02, b:  0.02 },
      gamma: { r: -0.02, g:  0.00, b:  0.03 },
      gain:  { r:  0.02, g:  0.02, b:  0.05 },
    },
    saturation: -5, contrast: 32, vibrance: 0, temperature: -22, tint: 0,
    grain: 5, halation: 4, vignette: 8, softness: 0,
    notes: "Matrix-era CCD camcorders. Sharp, cool, plastic.",
    year: 2001,
  },
  {
    id: "2010s-instagram",
    name: "2010s · Instagram",
    description: "Faded blacks, warm bias, soft contrast — the Valencia / X-Pro look.",
    category: "era",
    swatch: { primary: "#FBBF24", secondary: "#1E293B", accent: "#F59E0B" },
    wheel: {
      lift:  { r:  0.04, g:  0.03, b:  0.02 },
      gamma: { r:  0.04, g:  0.02, b: -0.02 },
      gain:  { r:  0.04, g:  0.02, b: -0.03 },
    },
    saturation: -5, contrast: -8, vibrance: 14, temperature: 18, tint: -2,
    grain: 12, halation: 8, vignette: 28, softness: 8,
    notes: "Every food photo from 2014. Soft and warm by default.",
    year: 2014,
  },
  {
    id: "60s-technicolor",
    name: "1960s · Technicolor",
    description: "Saturated three-strip primaries — Hitchcock, Demy, Wizard of Oz.",
    category: "era",
    swatch: { primary: "#DC143C", secondary: "#FFD700", accent: "#1E88E5" },
    wheel: {
      lift:  { r:  0.02, g:  0.00, b:  0.02 },
      gamma: { r:  0.04, g:  0.03, b:  0.04 },
      gain:  { r:  0.05, g:  0.04, b:  0.05 },
    },
    saturation: 38, contrast: 22, vibrance: 25, temperature: 5, tint: -3,
    grain: 18, halation: 12, vignette: 10, softness: 8,
    notes: "Mary Poppins energy. Color so loud it's a character.",
    year: 1964,
  },

  // ─── MOODS (5) ────────────────────────────────────────────────────
  {
    id: "teal-orange",
    name: "Teal & Orange",
    description: "The action-blockbuster grade — complementary push, skin pops against sky.",
    category: "mood",
    swatch: { primary: "#FF6B35", secondary: "#2E8B57", accent: "#F4D88A" },
    wheel: {
      lift:  { r:  0.04, g:  0.00, b: -0.04 },
      gamma: { r:  0.06, g:  0.00, b: -0.05 },
      gain:  { r:  0.05, g: -0.02, b: -0.05 },
    },
    saturation: 18, contrast: 28, vibrance: 12, temperature: 15, tint: -8,
    grain: 10, halation: 12, vignette: 18, softness: 5,
    notes: "Used on most Marvel films. Lazy but effective.",
    year: 2008,
  },
  {
    id: "noir",
    name: "Film Noir",
    description: "Hard contrast B&W with silver shadows and bright skin — dangerous light.",
    category: "mood",
    swatch: { primary: "#0A0A0A", secondary: "#D4D4D4", accent: "#737373" },
    wheel: {
      lift:  { r: -0.06, g: -0.06, b: -0.06 },
      gamma: { r:  0.00, g:  0.00, b:  0.00 },
      gain:  { r:  0.04, g:  0.04, b:  0.04 },
    },
    saturation: -100, contrast: 42, vibrance: 0, temperature: 0, tint: 0,
    grain: 18, halation: 0, vignette: 25, softness: 4,
    notes: "Out of the Past, Double Indemnity. Light is fate.",
    year: 1947,
  },
  {
    id: "dreampunk",
    name: "Dreampunk",
    description: "Pastel haze, prismatic light leaks, lavender shadows.",
    category: "mood",
    swatch: { primary: "#C4B5FD", secondary: "#FBCFE8", accent: "#A7F3D0" },
    wheel: {
      lift:  { r:  0.05, g:  0.02, b:  0.06 },
      gamma: { r:  0.04, g:  0.03, b:  0.05 },
      gain:  { r:  0.06, g:  0.04, b:  0.06 },
    },
    saturation: 18, contrast: -8, vibrance: 15, temperature: -8, tint: 14,
    grain: 22, halation: 35, vignette: 25, softness: 22,
    notes: "Liminal-space aesthetics. Dreams remembered next morning.",
  },
  {
    id: "chrome-glam",
    name: "Chrome Glam",
    description: "Polished metallic look — hard rim lights, oil-slick highlights, fashion sharpness.",
    category: "mood",
    swatch: { primary: "#E5E7EB", secondary: "#A78BFA", accent: "#FBBF24" },
    wheel: {
      lift:  { r: -0.02, g: -0.02, b: -0.01 },
      gamma: { r:  0.02, g:  0.02, b:  0.04 },
      gain:  { r:  0.05, g:  0.05, b:  0.06 },
    },
    saturation: 12, contrast: 22, vibrance: 8, temperature: -8, tint: 5,
    grain: 5, halation: 15, vignette: 12, softness: 0,
    notes: "Vogue cover circa 2024. Hard-light expensive.",
  },
  {
    id: "horror-crimson",
    name: "Horror · Crimson",
    description: "Desaturated palette except crimson accents — low-key, sweat on the lens.",
    category: "mood",
    swatch: { primary: "#7F1D1D", secondary: "#0A0A0A", accent: "#FEF2F2" },
    wheel: {
      lift:  { r:  0.04, g: -0.04, b: -0.04 },
      gamma: { r:  0.02, g: -0.03, b: -0.03 },
      gain:  { r:  0.04, g: -0.02, b: -0.02 },
    },
    saturation: -38, contrast: 28, vibrance: -12, temperature: 8, tint: 5,
    grain: 28, halation: 18, vignette: 32, softness: 8,
    notes: "It Follows, The Witch. Color drained except where it matters.",
    year: 2014,
  },

  // ─── UTILITY (4) ──────────────────────────────────────────────────
  {
    id: "rec709-show",
    name: "Rec.709 Show",
    description: "Broadcast-ready, no aesthetic push — accurate, neutral, deliverable.",
    category: "utility",
    swatch: { primary: "#FFFFFF", secondary: "#1A1A1A", accent: "#9CA3AF" },
    wheel: {
      lift:  { r: 0, g: 0, b: 0 },
      gamma: { r: 0, g: 0, b: 0 },
      gain:  { r: 0, g: 0, b: 0 },
    },
    saturation: 0, contrast: 4, vibrance: 0, temperature: 0, tint: 0,
    notes: "Use as a starting point. Lift up from here.",
  },
  {
    id: "log-flat",
    name: "Log · Flat",
    description: "Pulls everything to a gray midrange — useful for examining tonality.",
    category: "utility",
    swatch: { primary: "#737373", secondary: "#A3A3A3", accent: "#404040" },
    wheel: {
      lift:  { r:  0.08, g:  0.08, b:  0.08 },
      gamma: { r:  0.00, g:  0.00, b:  0.00 },
      gain:  { r: -0.08, g: -0.08, b: -0.08 },
    },
    saturation: -50, contrast: -45, vibrance: 0, temperature: 0, tint: 0,
    notes: "Inspect-mode only. Never deliver this.",
  },
  {
    id: "skin-warm",
    name: "Skin · Warm",
    description: "Neutral grade with skintone protection — subtle but flattering.",
    category: "utility",
    swatch: { primary: "#F4C77A", secondary: "#D4A574", accent: "#A8744A" },
    wheel: {
      lift:  { r:  0.01, g:  0.00, b: -0.01 },
      gamma: { r:  0.03, g:  0.01, b: -0.02 },
      gain:  { r:  0.02, g:  0.01, b: -0.02 },
    },
    saturation: 5, contrast: 6, vibrance: 12, temperature: 8, tint: -2,
    notes: "Wedding default. Make everyone look the way they wish they did.",
  },
  {
    id: "punch-up",
    name: "Punch Up",
    description: "Universal contrast + saturation boost — wake a tired clip up by 20%.",
    category: "utility",
    swatch: { primary: "#1A1A1A", secondary: "#FFFFFF", accent: "#FBBF24" },
    wheel: {
      lift:  { r: -0.03, g: -0.03, b: -0.03 },
      gamma: { r:  0.02, g:  0.02, b:  0.02 },
      gain:  { r:  0.04, g:  0.04, b:  0.04 },
    },
    saturation: 18, contrast: 25, vibrance: 12, temperature: 0, tint: 0,
    notes: "Use sparingly. Easy to overdose.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export function getLut(id: string): LutLook | undefined {
  return LUT_LIBRARY.find(l => l.id === id);
}

export function getLutsByCategory(category: LutLook["category"]): LutLook[] {
  return LUT_LIBRARY.filter(l => l.category === category);
}

export function groupLutsByCategory(): Record<LutLook["category"], LutLook[]> {
  const groups: Record<LutLook["category"], LutLook[]> = {
    "film-stock": [], "era": [], "mood": [], "director": [], "utility": [],
  };
  for (const l of LUT_LIBRARY) groups[l.category].push(l);
  return groups;
}
