import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Optional sub-row rendered below the divider (toolbar, tabs, filters) */
  toolbar?: ReactNode;
  /** When true (default) renders the cinematic backdrop behind the header
   *  (orbital ring, holographic particles, aurora wash). Set false to opt
   *  out for ultra-dense pages. */
  cinematic?: boolean;
}

/**
 * PageHeader — editorial page header with eyebrow, display title,
 * subtitle, optional actions, hairline divider and optional toolbar row.
 *
 * Cinematic mode (on by default) layers a landing-page "Enter Studio"
 * inspired backdrop: orbital ring, drifting holographic particles, and
 * an aurora spotlight behind the display title.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  toolbar,
  cinematic = true,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'relative mb-10 sm:mb-14 animate-fade-in spotlight-wash',
        className,
      )}
    >
      {cinematic && (
        <>
          {/* Aurora wash — anchored to the title */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 -left-10 w-[420px] h-[280px] rounded-full opacity-70 blur-[80px]"
            style={{
              background:
                'radial-gradient(closest-side, hsla(215,100%,55%,0.22), transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-6 right-10 w-[320px] h-[200px] rounded-full opacity-50 blur-[80px]"
            style={{
              background:
                'radial-gradient(closest-side, hsla(200,100%,60%,0.16), transparent 70%)',
            }}
          />
          {/* Drifting holographic particles — hidden on mobile to save GPU */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden hidden md:block">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  top: `${10 + i * 14}%`,
                  left: `${6 + i * 16}%`,
                  background:
                    i % 2 === 0
                      ? 'hsl(215, 100%, 65%)'
                      : 'hsl(200, 100%, 70%)',
                  boxShadow:
                    i % 2 === 0
                      ? '0 0 8px hsla(215,100%,55%,0.55)'
                      : '0 0 8px hsla(200,100%,65%,0.45)',
                  animation: `particle-drift ${5 + i * 0.6}s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                  ['--drift-x' as string]: `${(i % 3 - 1) * 22}px`,
                  ['--drift-y' as string]: `${-14 - i * 4}px`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <div className="text-eyebrow-rule mb-4">{eyebrow}</div>}
          <h1 className="text-display-luxe">{title}</h1>
          {subtitle && (
            <p className="text-body-muted mt-4 max-w-xl">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      <div className="hairline-luxe mt-9" />
      {toolbar && <div className="mt-6">{toolbar}</div>}
    </header>
  );
}

export default PageHeader;