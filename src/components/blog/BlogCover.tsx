/**
 * BlogCover — deterministic, generated post artwork.
 *
 * There are no external image files: every cover is synthesized purely from the
 * post's slug + title via CSS, so a cover can never 404 and two posts can never
 * share the same art. The slug is hashed (FNV-1a) into a base hue; from that hue
 * we build a cinematic multi-stop gradient, an accent glow, a fine grid, a noise
 * grain, a vignette and an oversized ghosted-typography treatment of the title.
 * The result is a premium, dark, editorial poster that is unique per post.
 *
 * The component is a CONTAINER: it paints the art and renders `children`
 * (badges, headings, meta) on top, so callers keep full control of readable
 * foreground content and SEO text stays in the DOM.
 */
import { memo, type ReactNode, type CSSProperties } from 'react';

/** FNV-1a → stable hue in [0, 360). Same slug always yields the same color. */
export function hueFromSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

type Variant = 'featured' | 'detail' | 'card' | 'related';

const VARIANTS: Record<Variant, { aspect: string; ghost: string; grid: number; pad: string }> = {
  featured: { aspect: 'aspect-[21/9]', ghost: 'text-[14vw] sm:text-[11vw] lg:text-[8.5vw]', grid: 56, pad: 'p-7 md:p-9' },
  detail: { aspect: 'aspect-[16/7]', ghost: 'text-[16vw] sm:text-[12vw] lg:text-[9.5vw]', grid: 52, pad: 'p-7 md:p-9' },
  card: { aspect: 'aspect-video', ghost: 'text-3xl sm:text-4xl', grid: 34, pad: 'p-5' },
  related: { aspect: 'aspect-video', ghost: 'text-2xl', grid: 26, pad: 'p-4' },
};

// Lightweight SVG grain — inlined as a data URI so there's zero network cost.
const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

interface BlogCoverProps {
  title: string;
  hue: number;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
}

function BlogCoverImpl({ title, hue, variant = 'card', className = '', children }: BlogCoverProps) {
  const v = VARIANTS[variant];
  const h1 = hue;
  const h2 = (hue + 38) % 360;
  const h3 = (hue + 318) % 360;

  // Cinematic dark base + two colored glows, all derived from the post's hue.
  const baseStyle: CSSProperties = {
    backgroundColor: '#050505',
    backgroundImage: `linear-gradient(152deg, hsl(${h1} 58% 10%) 0%, hsl(${h1} 62% 6%) 46%, #050505 96%)`,
  };
  const glowStyle: CSSProperties = {
    backgroundImage: [
      `radial-gradient(120% 120% at 84% 8%, hsl(${h2} 88% 56% / 0.42), transparent 56%)`,
      `radial-gradient(110% 110% at 8% 100%, hsl(${h3} 82% 46% / 0.34), transparent 52%)`,
    ].join(', '),
  };
  const gridStyle: CSSProperties = {
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
    backgroundSize: `${v.grid}px ${v.grid}px`,
    maskImage: 'radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 90%)',
    WebkitMaskImage: 'radial-gradient(120% 100% at 50% 0%, #000 35%, transparent 90%)',
  };
  const ghostStyle: CSSProperties = {
    maskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 92%)',
    WebkitMaskImage: 'linear-gradient(180deg, #000 0%, #000 55%, transparent 92%)',
  };

  return (
    <div className={`relative isolate overflow-hidden ${v.aspect} ${className}`} style={baseStyle}>
      {/* colored glows — intensify on hover when nested in a `group` */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        style={glowStyle}
      />
      {/* fine technical grid */}
      <div className="absolute inset-0" style={gridStyle} />
      {/* oversized ghost-typography of the title — the signature, per-post art */}
      <div aria-hidden className={`pointer-events-none absolute inset-0 flex items-start ${v.pad}`}>
        <span
          className={`font-black uppercase tracking-[-0.04em] leading-[0.8] text-white/[0.07] ${v.ghost} line-clamp-3 transition-colors duration-500 group-hover:text-white/[0.1]`}
          style={ghostStyle}
        >
          {title}
        </span>
      </div>
      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
      />
      {/* accent hairline + bottom vignette for foreground legibility */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${h2} 90% 62% / 0.7), transparent)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
      {/* readable foreground content */}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

export const BlogCover = memo(BlogCoverImpl);
