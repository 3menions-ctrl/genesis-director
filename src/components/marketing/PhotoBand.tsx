/**
 * PhotoBand — a large, topical photograph as a framed content band. Sits on top
 * of whatever backdrop the page already has (park, violet, …) to add real
 * imagery without replacing the page's design. Premium framing: rounded, a
 * hairline border, a bottom scrim, and an optional eyebrow + caption.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface PhotoBandProps {
  src: string;
  alt: string;
  eyebrow?: string;
  caption?: string;
  /** Tailwind height clamp override; defaults to a generous editorial band. */
  heightClass?: string;
  className?: string;
}

function PhotoBandImpl({ src, alt, eyebrow, caption, heightClass, className }: PhotoBandProps) {
  return (
    <section className={cn('relative z-10 px-5 sm:px-8', className)}>
      <figure className="mx-auto max-w-6xl">
        <div className="group relative overflow-hidden rounded-3xl border border-white/[0.09] shadow-[0_50px_140px_-60px_rgba(0,0,0,0.95)]">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className={cn('w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]', heightClass ?? 'h-[clamp(15rem,40vw,28rem)]')}
          />
          {/* top hairline + bottom scrim for legibility */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          {(eyebrow || caption) && (
            <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
              {eyebrow && <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-white/70">{eyebrow}</div>}
              {caption && <div className="mt-2 max-w-2xl font-display text-[clamp(1.15rem,2.6vw,1.9rem)] font-medium leading-tight tracking-[-0.01em] text-white">{caption}</div>}
            </figcaption>
          )}
        </div>
      </figure>
    </section>
  );
}

export const PhotoBand = memo(PhotoBandImpl);
export default PhotoBand;
