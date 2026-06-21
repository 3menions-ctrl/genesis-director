/**
 * Effects registry — all 20 Crossover recipes declared as in-editor
 * effects with editorial metadata, default parameters, and a list of
 * supported application modes.
 *
 * Hero recipes (6) ship with their own custom renderer component (see
 * `src/components/editor/effects/recipes/`). The remaining 14 fall
 * back to the generic placeholder until each gets its custom build.
 */
import type { RecipeSlug } from "@/lib/crossovers/blueprint";
import type { EffectMode, BlendMode } from "./effects";
import {
  Sparkles,
  Zap,
  Flame,
  Droplet,
  Wind,
  Sun,
  Wand2,
  Bomb,
  Activity,
  Square,
  Aperture,
  Pipette,
  Ghost,
  Magnet,
  Cpu,
  Layers,
  Scissors,
  Disc3,
  Snowflake,
  Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Registry types
// ─────────────────────────────────────────────────────────────────────────────
export interface EffectRecipeMeta {
  slug: RecipeSlug;
  name: string;
  /** One-line editorial description for the effect browser. */
  description: string;
  /** Category — used to group in the picker. */
  category: "light" | "particle" | "optical" | "pigment" | "geometric" | "atmospheric";
  /** Icon for the browser tile. */
  icon: LucideIcon;

  /** Application modes this recipe supports. Most support all three;
   *  some are tied to a particular mode (e.g. paint_pour is best as a
   *  transition, light_beam only makes sense sustained). */
  modes: EffectMode[];

  /** Signature swatch — picks for the browser tile, also the default
   *  primary/accent on a new instance. */
  swatch: { primary: string; secondary: string; accent: string };

  /** Default blend mode hint — when omitted, effects.ts picks one
   *  from the recipe-aware default. */
  defaultBlend?: BlendMode;

  /** Whether a bespoke renderer component exists. When false, the
   *  generic placeholder fills in (subtle radial bloom with the
   *  primary color). */
  hasCustomRenderer: boolean;

  /** A one-line editorial note about WHEN to reach for this effect. */
  bestFor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY — 20 recipes
// ─────────────────────────────────────────────────────────────────────────────
export const EFFECT_REGISTRY: EffectRecipeMeta[] = [
  // ─── LIGHT (6 of the most-used) ────────────────────────────────────
  {
    slug: "light_beam",
    name: "Light Beam",
    description: "Sweeping volumetric god ray across the frame.",
    category: "light",
    icon: Sun,
    modes: ["sustained", "stinger"],
    swatch: { primary: "#FFE49C", secondary: "#FFFFFF", accent: "#FFB347" },
    hasCustomRenderer: true,
    bestFor: "Overlay across a hero shot. Subtle and constant.",
  },
  {
    slug: "neon_zap",
    name: "Neon Zap",
    description: "Crackling electric lightning bolt with bloom halo.",
    category: "light",
    icon: Zap,
    modes: ["stinger", "transition"],
    swatch: { primary: "#22D3EE", secondary: "#FF2EA6", accent: "#FFFFFF" },
    hasCustomRenderer: true,
    bestFor: "Punctuate a beat drop or product reveal.",
  },
  {
    slug: "particle_burst",
    name: "Particle Burst",
    description: "Radial explosion of soft glowing particles.",
    category: "particle",
    icon: Sparkles,
    modes: ["stinger", "transition"],
    swatch: { primary: "#FBBF24", secondary: "#FFFFFF", accent: "#FF6B35" },
    hasCustomRenderer: true,
    bestFor: "Climax moment. Joyful, kinetic.",
  },
  {
    slug: "energy_crackle",
    name: "Energy Crackle",
    description: "Pulsing electric corona around a focal point.",
    category: "light",
    icon: Activity,
    modes: ["sustained", "stinger"],
    swatch: { primary: "#22D3EE", secondary: "#FFD700", accent: "#000000" },
    hasCustomRenderer: false,
    bestFor: "Around a character or object that 'has the power.'",
  },
  {
    slug: "ghost_pulse",
    name: "Ghost Pulse",
    description: "Slow rhythmic alpha echo of the subject.",
    category: "atmospheric",
    icon: Ghost,
    modes: ["sustained"],
    swatch: { primary: "#C4B5FD", secondary: "#FFFFFF", accent: "#1F2937" },
    hasCustomRenderer: false,
    bestFor: "Memory / dream / out-of-body sequences.",
  },
  {
    slug: "data_stream",
    name: "Data Stream",
    description: "Falling-code raindrops across the frame.",
    category: "atmospheric",
    icon: Cpu,
    modes: ["sustained"],
    swatch: { primary: "#22C55E", secondary: "#16A34A", accent: "#000000" },
    hasCustomRenderer: false,
    bestFor: "Matrix-style cyber sequences. Sustained mood.",
  },

  // ─── PARTICLE / EXPLOSIVE (4) ──────────────────────────────────────
  {
    slug: "glass_shatter",
    name: "Glass Shatter",
    description: "Volumetric glass shards radiating outward.",
    category: "geometric",
    icon: Square,
    modes: ["stinger", "transition"],
    swatch: { primary: "#E0F2FE", secondary: "#FFFFFF", accent: "#0EA5E9" },
    hasCustomRenderer: true,
    bestFor: "Breakthrough moments. The 4th-wall break.",
  },
  {
    slug: "smoke_burst",
    name: "Smoke Burst",
    description: "Volumetric smoke cloud erupting outward.",
    category: "particle",
    icon: Wind,
    modes: ["stinger", "transition"],
    swatch: { primary: "#9CA3AF", secondary: "#D4D4D8", accent: "#1F2937" },
    hasCustomRenderer: true,
    bestFor: "Magician reveal, vanish, sudden appearance.",
  },
  {
    slug: "fire_lick",
    name: "Fire Lick",
    description: "Tongues of flame licking the bottom edge.",
    category: "particle",
    icon: Flame,
    modes: ["sustained", "stinger"],
    swatch: { primary: "#FF4500", secondary: "#FFD700", accent: "#7F1D1D" },
    hasCustomRenderer: false,
    bestFor: "Hellish, dramatic, intense atmosphere.",
  },
  {
    slug: "water_splash",
    name: "Water Splash",
    description: "Refractive water droplets and a wet sheen.",
    category: "particle",
    icon: Droplet,
    modes: ["stinger", "transition"],
    swatch: { primary: "#0EA5E9", secondary: "#FFFFFF", accent: "#1E3A8A" },
    hasCustomRenderer: false,
    bestFor: "Refreshing / cleansing / reveal moments.",
  },

  // ─── PIGMENT (3) ───────────────────────────────────────────────────
  {
    slug: "ink_bloom",
    name: "Ink Bloom",
    description: "Liquid ink blooming across the frame from a point.",
    category: "pigment",
    icon: Droplet,
    modes: ["transition", "stinger"],
    swatch: { primary: "#1E1B4B", secondary: "#FFFFFF", accent: "#7C3AED" },
    hasCustomRenderer: false,
    bestFor: "Inkwell narrative beats. Poetic, organic.",
  },
  {
    slug: "paint_pour",
    name: "Paint Pour",
    description: "Cascading paint flooding the frame from above.",
    category: "pigment",
    icon: Droplet,
    modes: ["transition"],
    swatch: { primary: "#EC4899", secondary: "#FBBF24", accent: "#3B82F6" },
    hasCustomRenderer: false,
    bestFor: "Style-change transitions. Bold, declarative.",
  },
  {
    slug: "color_pop",
    name: "Color Pop",
    description: "Sudden saturated bloom of a key color.",
    category: "pigment",
    icon: Pipette,
    modes: ["stinger", "sustained"],
    swatch: { primary: "#EF4444", secondary: "#FBBF24", accent: "#FFFFFF" },
    hasCustomRenderer: false,
    bestFor: "Emphasize one prop or character against B&W.",
  },

  // ─── GEOMETRIC (3) ────────────────────────────────────────────────
  {
    slug: "frame_break",
    name: "Frame Break",
    description: "The aspect-ratio frame fractures and slides apart.",
    category: "geometric",
    icon: Scissors,
    modes: ["transition", "stinger"],
    swatch: { primary: "#FFFFFF", secondary: "#000000", accent: "#FBBF24" },
    hasCustomRenderer: true,
    bestFor: "Format-aware moments. Aspect-ratio is part of the joke.",
  },
  {
    slug: "pixel_dissolve",
    name: "Pixel Dissolve",
    description: "Frame scatters into a swarm of pixels.",
    category: "geometric",
    icon: Disc3,
    modes: ["transition", "stinger"],
    swatch: { primary: "#22D3EE", secondary: "#000000", accent: "#FF2EA6" },
    hasCustomRenderer: false,
    bestFor: "Tech / sci-fi / 8-bit transitions.",
  },
  {
    slug: "ribbon_unfurl",
    name: "Ribbon Unfurl",
    description: "A satin ribbon unfurls horizontally across the frame.",
    category: "geometric",
    icon: Wand2,
    modes: ["transition", "stinger"],
    swatch: { primary: "#EC4899", secondary: "#FBBF24", accent: "#FFFFFF" },
    hasCustomRenderer: false,
    bestFor: "Awards-show / gift-reveal moments.",
  },

  // ─── OPTICAL (3) ──────────────────────────────────────────────────
  {
    slug: "lens_distort",
    name: "Lens Distort",
    description: "Barrel distortion + chromatic aberration pulse.",
    category: "optical",
    icon: Aperture,
    modes: ["stinger", "transition"],
    swatch: { primary: "#FF2EA6", secondary: "#22D3EE", accent: "#000000" },
    hasCustomRenderer: false,
    bestFor: "Disorientation, intoxication, time loop.",
  },
  {
    slug: "static_fizz",
    name: "Static Fizz",
    description: "Analog TV static / signal-loss flicker.",
    category: "optical",
    icon: Cpu,
    modes: ["stinger", "sustained"],
    swatch: { primary: "#FFFFFF", secondary: "#000000", accent: "#9CA3AF" },
    hasCustomRenderer: false,
    bestFor: "Transmission / found-footage / VHS aesthetic.",
  },
  {
    slug: "magnet_pull",
    name: "Magnet Pull",
    description: "All frame elements drift toward a focal point.",
    category: "optical",
    icon: Magnet,
    modes: ["stinger", "transition"],
    swatch: { primary: "#3B82F6", secondary: "#FFFFFF", accent: "#1E40AF" },
    hasCustomRenderer: false,
    bestFor: "Convergence on a hero, vortex pull-ins.",
  },

  // ─── EXTRA / FABRIC (1) ───────────────────────────────────────────
  {
    slug: "fabric_tear",
    name: "Fabric Tear",
    description: "Frame tears like fabric, revealing the next layer.",
    category: "geometric",
    icon: Scissors,
    modes: ["transition"],
    swatch: { primary: "#1F2937", secondary: "#FBBF24", accent: "#EF4444" },
    hasCustomRenderer: false,
    bestFor: "Dramatic reveals. Rip back the curtain.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export function getRecipeMeta(slug: RecipeSlug): EffectRecipeMeta | undefined {
  return EFFECT_REGISTRY.find(r => r.slug === slug);
}

export function getRecipesByCategory(): Record<EffectRecipeMeta["category"], EffectRecipeMeta[]> {
  const groups: Record<EffectRecipeMeta["category"], EffectRecipeMeta[]> = {
    light: [], particle: [], optical: [], pigment: [], geometric: [], atmospheric: [],
  };
  for (const r of EFFECT_REGISTRY) groups[r.category].push(r);
  return groups;
}

export const EFFECT_CATEGORY_LABELS: Record<EffectRecipeMeta["category"], string> = {
  light:       "Light & Energy",
  particle:    "Particles & Explosions",
  optical:     "Optical & Lens",
  pigment:     "Pigment & Ink",
  geometric:   "Geometric & Frame",
  atmospheric: "Atmospheric Overlays",
};

// Recipes that supply a default `Star` icon — Star is reserved for
// favourites in the UI, so keep this list synced if you reorganize.
void Star; void Snowflake; void Bomb; void Layers;
