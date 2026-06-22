/**
 * PageHero — the shared premium hero/cover band for marketing + legal pages
 * (Terms, Privacy, Press, Contact, Developers, …).
 *
 * One consistent backdrop everywhere: the Hoppy "park" frame (avatar removed —
 * a symmetric, blurred tree-line + lawn), under a 60%-opaque dark blind and a
 * light-green → dark-green shade, with SVG grain, a green hairline, and a
 * bottom vignette so white headlines stay legible. `accentKey` is retained for
 * call-site compatibility but no longer varies the color — every page reads the
 * same cohesive green.
 */
import { memo, type ReactNode, type CSSProperties } from 'react';

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

/** Shared Hoppy-park backdrop (avatar removed). */
const PARK_IMG = '/cinema-assets/footer-park.jpg';

interface PageHeroProps {
  /** Retained for call-site compatibility; no longer varies the color. */
  accentKey?: string;
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

function PageHeroImpl({ eyebrow, title, subtitle, meta, actions, className = '' }: PageHeroProps) {
  const baseStyle: CSSProperties = { backgroundColor: '#08130c' };
  const photoStyle: CSSProperties = {
    backgroundImage: `url("${PARK_IMG}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 42%',
  };
  // Light-green → dark-green shade layered over the 60% dark blind.
  const shadeStyle: CSSProperties = {
    backgroundImage:
      'linear-gradient(159deg, rgba(150,205,110,0.20) 0%, rgba(20,58,34,0.46) 46%, rgba(5,16,10,0.82) 100%)',
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
      {/* park photo (avatar removed) */}
      <div aria-hidden className="absolute inset-0" style={photoStyle} />
      {/* 60% dark blind */}
      <div aria-hidden className="absolute inset-0 bg-black/60" />
      {/* light-green → dark-green shade */}
      <div aria-hidden className="absolute inset-0" style={shadeStyle} />
      <div aria-hidden className="absolute inset-0" style={gridStyle} />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE}")`, backgroundSize: '160px 160px' }}
      />
      {/* green hairline at the top edge */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(140 70% 60% / 0.7), transparent)' }}
      />
      {/* bottom vignette for legibility against page content below */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 to-transparent" />

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
