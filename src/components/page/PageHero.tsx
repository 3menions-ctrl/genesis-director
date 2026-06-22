/**
 * PageHero — the shared premium hero/cover band for marketing + legal pages
 * (Terms, Privacy, Press, Contact, Developers, …).
 *
 * Same generated-art language as the blog covers: a unique accent hue is hashed
 * from `accentKey`, then a cinematic dark gradient + two colored glows + a fine
 * grid + SVG grain + a vignette are layered behind the headline. No external
 * image files — covers can never 404 and every page reads distinct yet cohesive.
 */
import { memo, type ReactNode, type CSSProperties } from 'react';
import { hueFromSlug } from '@/components/blog/BlogCover';

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

interface PageHeroProps {
  /** Drives the accent hue — pass a stable per-page key, e.g. "terms". */
  accentKey: string;
  /** Small mono eyebrow above the title, e.g. "Legal". */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional meta line (e.g. "Last updated June 22, 2026"). */
  meta?: ReactNode;
  /** Optional actions row (buttons/links). */
  actions?: ReactNode;
  className?: string;
}

function PageHeroImpl({ accentKey, eyebrow, title, subtitle, meta, actions, className = '' }: PageHeroProps) {
  const h1 = hueFromSlug(accentKey);
  const h2 = (h1 + 38) % 360;
  const h3 = (h1 + 318) % 360;

  const baseStyle: CSSProperties = {
    backgroundColor: '#050505',
    backgroundImage: `linear-gradient(152deg, hsl(${h1} 58% 10%) 0%, hsl(${h1} 60% 6%) 48%, #050505 96%)`,
  };
  const glowStyle: CSSProperties = {
    backgroundImage: [
      `radial-gradient(90% 130% at 86% 0%, hsl(${h2} 88% 56% / 0.38), transparent 56%)`,
      `radial-gradient(80% 120% at 6% 100%, hsl(${h3} 82% 46% / 0.30), transparent 54%)`,
    ].join(', '),
  };
  const gridStyle: CSSProperties = {
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
    backgroundSize: '54px 54px',
    maskImage: 'radial-gradient(120% 120% at 50% 0%, #000 30%, transparent 88%)',
    WebkitMaskImage: 'radial-gradient(120% 120% at 50% 0%, #000 30%, transparent 88%)',
  };

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] ${className}`}
      style={baseStyle}
    >
      <div aria-hidden className="absolute inset-0" style={glowStyle} />
      <div aria-hidden className="absolute inset-0" style={gridStyle} />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
      />
      {/* accent hairline at the top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, hsl(${h2} 90% 62% / 0.7), transparent)` }}
      />
      {/* bottom vignette for legibility against page content below */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="relative px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24 max-w-4xl">
        {eyebrow && (
          <div className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45 mb-5">{eyebrow}</div>
        )}
        <h1 className="font-display text-white font-bold tracking-[-0.02em] leading-[1.02] text-[clamp(2.2rem,5.5vw,4rem)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 text-white/60 text-[15px] sm:text-[17px] leading-relaxed max-w-2xl">{subtitle}</p>
        )}
        {meta && (
          <div className="mt-6 text-[11px] font-mono uppercase tracking-[0.28em] text-white/35">{meta}</div>
        )}
        {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </section>
  );
}

export const PageHero = memo(PageHeroImpl);
export default PageHero;
