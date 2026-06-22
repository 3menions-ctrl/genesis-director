/**
 * BlogCover — deterministic, generated post artwork (no external image files).
 *
 * Earlier versions varied only by `hue = hash % 360`, which CLUSTERED: slugs
 * whose hash landed 1–2° apart produced visually identical covers. This version
 * drives THREE independent visual axes from separate slices of the full 32-bit
 * slug hash:
 *   • palette  — one of 14 curated, well-separated color families
 *   • pattern  — one of 6 motifs (grid / dots / diagonals / rings / scan / mesh)
 *   • layout   — one of 4 glow arrangements
 * 14 × 6 × 4 = 336 combinations, and each axis is a STRONG visual change — so
 * two posts essentially never read as the same art, and adjacent-hash slugs
 * diverge hard because the full hash (not hash % 360) drives every axis.
 */
import { memo, type ReactNode, type CSSProperties } from 'react';

/** FNV-1a 32-bit hash of a string (stable across runs). */
function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Back-compat hue helper (still used by PageHero). */
export function hueFromSlug(slug: string): number {
  return hashSlug(slug) % 360;
}

// 14 curated, deliberately well-separated color families.
const PALETTES: ReadonlyArray<{ base: number; accent: number; sat: number }> = [
  { base: 350, accent: 14, sat: 70 },  // crimson
  { base: 18, accent: 36, sat: 78 },   // orange
  { base: 42, accent: 30, sat: 80 },   // amber/gold
  { base: 70, accent: 92, sat: 62 },   // chartreuse
  { base: 145, accent: 165, sat: 64 }, // emerald
  { base: 172, accent: 188, sat: 66 }, // teal
  { base: 192, accent: 205, sat: 72 }, // cyan
  { base: 212, accent: 226, sat: 78 }, // azure
  { base: 232, accent: 248, sat: 74 }, // blue
  { base: 256, accent: 272, sat: 70 }, // indigo
  { base: 278, accent: 292, sat: 68 }, // violet
  { base: 300, accent: 316, sat: 66 }, // purple
  { base: 322, accent: 338, sat: 72 }, // magenta
  { base: 338, accent: 352, sat: 74 }, // rose
];

// 6 pattern motifs (returns a CSS background layer keyed to grid scale `g`).
function patternStyle(idx: number, g: number): CSSProperties {
  const L = 'rgba(255,255,255,0.05)';
  switch (idx % 6) {
    case 0: // grid
      return {
        backgroundImage: `linear-gradient(${L} 1px, transparent 1px), linear-gradient(90deg, ${L} 1px, transparent 1px)`,
        backgroundSize: `${g}px ${g}px`,
      };
    case 1: // dots
      return {
        backgroundImage: `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px)`,
        backgroundSize: `${g * 0.7}px ${g * 0.7}px`,
      };
    case 2: // diagonal hatch
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${L} 0 1px, transparent 1px ${Math.round(g * 0.5)}px)`,
      };
    case 3: // concentric rings
      return {
        backgroundImage: `repeating-radial-gradient(circle at 70% 18%, ${L} 0 1px, transparent 1px ${Math.round(g * 0.8)}px)`,
      };
    case 4: // horizontal scanlines
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${L} 0 1px, transparent 1px ${Math.max(5, Math.round(g * 0.28))}px)`,
      };
    default: // diamond mesh
      return {
        backgroundImage: `repeating-linear-gradient(45deg, ${L} 0 1px, transparent 1px ${Math.round(g * 0.6)}px), repeating-linear-gradient(-45deg, ${L} 0 1px, transparent 1px ${Math.round(g * 0.6)}px)`,
      };
  }
}

// 4 glow layouts — two radial accent positions each.
function glowStyle(idx: number, h2: number, h3: number, sat: number): CSSProperties {
  const a = `hsl(${h2} ${sat + 18}% 56% / 0.42)`;
  const b = `hsl(${h3} ${sat + 12}% 48% / 0.34)`;
  const layouts = [
    `radial-gradient(120% 120% at 84% 8%, ${a}, transparent 56%), radial-gradient(110% 110% at 8% 100%, ${b}, transparent 52%)`,
    `radial-gradient(120% 120% at 12% 6%, ${a}, transparent 56%), radial-gradient(120% 120% at 92% 94%, ${b}, transparent 52%)`,
    `radial-gradient(90% 90% at 50% -10%, ${a}, transparent 58%), radial-gradient(120% 120% at 50% 116%, ${b}, transparent 60%)`,
    `radial-gradient(80% 120% at 100% 50%, ${a}, transparent 54%), radial-gradient(80% 120% at 0% 50%, ${b}, transparent 54%)`,
  ];
  return { backgroundImage: layouts[idx % layouts.length] };
}

type Variant = 'featured' | 'detail' | 'card' | 'related';

const VARIANTS: Record<Variant, { aspect: string; ghost: string; grid: number; pad: string }> = {
  featured: { aspect: 'aspect-[21/9]', ghost: 'text-[14vw] sm:text-[11vw] lg:text-[8.5vw]', grid: 56, pad: 'p-7 md:p-9' },
  detail: { aspect: 'aspect-[16/7]', ghost: 'text-[16vw] sm:text-[12vw] lg:text-[9.5vw]', grid: 52, pad: 'p-7 md:p-9' },
  card: { aspect: 'aspect-video', ghost: 'text-3xl sm:text-4xl', grid: 34, pad: 'p-5' },
  related: { aspect: 'aspect-video', ghost: 'text-2xl', grid: 26, pad: 'p-4' },
};

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

interface BlogCoverProps {
  title: string;
  /** The post slug — drives all three visual axes deterministically. */
  seed: string;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
}

function BlogCoverImpl({ title, seed, variant = 'card', className = '', children }: BlogCoverProps) {
  const v = VARIANTS[variant];
  const hash = hashSlug(seed);

  // Independent axes from independent hash slices.
  const pal = PALETTES[hash % PALETTES.length];
  const patternIdx = (hash >>> 8) % 6;
  const layoutIdx = (hash >>> 16) % 4;
  const angle = 120 + ((hash >>> 22) % 80); // 120–199deg base gradient tilt

  const h1 = pal.base;
  const h2 = pal.accent;
  const h3 = (pal.base + 320) % 360;

  const baseStyle: CSSProperties = {
    backgroundColor: '#050505',
    backgroundImage: `linear-gradient(${angle}deg, hsl(${h1} ${pal.sat}% 11%) 0%, hsl(${h1} ${pal.sat - 6}% 6%) 48%, #050505 96%)`,
  };
  const grid: CSSProperties = {
    ...patternStyle(patternIdx, v.grid),
    maskImage: 'radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 92%)',
    WebkitMaskImage: 'radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 92%)',
  };
  const ghostMask: CSSProperties = {
    maskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 92%)',
    WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 92%)',
  };

  return (
    <div className={`relative isolate overflow-hidden ${v.aspect} ${className}`} style={baseStyle}>
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        style={glowStyle(layoutIdx, h2, h3, pal.sat)}
      />
      <div className="absolute inset-0" style={grid} />
      <div aria-hidden className={`pointer-events-none absolute inset-0 flex items-start ${v.pad}`}>
        <span
          className={`font-black uppercase tracking-[-0.04em] leading-[0.8] text-white/[0.07] ${v.ghost} line-clamp-3 transition-colors duration-500 group-hover:text-white/[0.1]`}
          style={ghostMask}
        >
          {title}
        </span>
      </div>
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${h2} 90% 62% / 0.7), transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export const BlogCover = memo(BlogCoverImpl);
export default BlogCover;
