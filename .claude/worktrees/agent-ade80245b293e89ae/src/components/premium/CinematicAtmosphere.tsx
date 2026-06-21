/**
 * Shared Cinematic Atmosphere — Pro-Dark + cinematic blue.
 * Conic aurora, halo bloom, twinkle starfield, scan-line, film grain.
 * Reusable signature backdrop for premium pages.
 */
import { memo } from 'react';

interface Props {
  /** Unique animation namespace per page (avoids collisions). */
  ns?: string;
  /** Density of star particles. Default 24. */
  stars?: number;
  /** Color tint override — blue (default), neutral. */
  tone?: 'blue';
}

export const CinematicAtmosphere = memo(function CinematicAtmosphere({
  ns = 'atm',
  stars = 24,
}: Props) {
  const k = (s: string) => `${ns}${s}`;
  return (
    <>
      <style>{`
        @keyframes ${k('Aurora')} { to { transform: rotate(360deg); } }
        @keyframes ${k('Tick')}   { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        @keyframes ${k('Float')}  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes ${k('Scan')}   { 0% { transform: translateY(-100%); } 100% { transform: translateY(120vh); } }
        @keyframes ${k('Twinkle')} { 0%,100% { opacity: 0.15; } 50% { opacity: 0.9; } }
      `}</style>
      <div className="fixed inset-0 -z-50 bg-[hsl(220,14%,2%)]" aria-hidden />
      <div
        className="fixed inset-0 -z-40 pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg at 50% 45%, transparent 0deg, hsla(215,100%,60%,0.32) 60deg, transparent 130deg, hsla(210,100%,55%,0.20) 220deg, transparent 300deg, hsla(215,100%,60%,0.26) 360deg)',
          filter: 'blur(95px)',
          animation: `${k('Aurora')} 75s linear infinite`,
          opacity: 0.85,
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 720, height: 720, top: '-20%', right: '-12%',
          background: 'radial-gradient(circle, hsla(215,100%,60%,0.18), transparent 65%)',
          filter: 'blur(60px)', animation: `${k('Float')} 16s ease-in-out infinite`,
        }}
        aria-hidden
      />
      <div
        className="fixed -z-30 pointer-events-none rounded-full"
        style={{
          width: 560, height: 560, bottom: '-15%', left: '-10%',
          background: 'radial-gradient(circle, hsla(210,100%,55%,0.14), transparent 65%)',
          filter: 'blur(70px)', animation: `${k('Float')} 20s ease-in-out infinite reverse`,
        }}
        aria-hidden
      />
      {/* Starfield */}
      <div className="fixed inset-0 -z-30 pointer-events-none overflow-hidden" aria-hidden>
        {Array.from({ length: stars }).map((_, i) => {
          const top = (i * 137.5) % 100;
          const left = (i * 73.3) % 100;
          const size = 1 + ((i * 7) % 3);
          const delay = (i * 0.31) % 6;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-[hsl(215,100%,75%)]"
              style={{
                top: `${top}%`, left: `${left}%`,
                width: size, height: size,
                boxShadow: '0 0 8px hsla(215,100%,68%,0.6)',
                animation: `${k('Twinkle')} ${5 + (i % 4)}s ease-in-out infinite`,
                animationDelay: `${delay}s`,
                opacity: 0.35,
              }}
            />
          );
        })}
      </div>
      <div
        className="fixed inset-x-0 -z-20 pointer-events-none h-[40vh]"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, hsla(215,100%,68%,0.05) 50%, transparent 100%)',
          animation: `${k('Scan')} 20s linear infinite`,
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-20 pointer-events-none opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.06 0 0 0 0 0.07 0 0 0 0 0.08 0 0 0 0.65 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, hsla(220,14%,1%,0.85) 100%)' }}
        aria-hidden
      />
    </>
  );
});

export const DiagnosticTicker = memo(function DiagnosticTicker({
  items,
  ns = 'atm',
}: { items: { code: string; label: string }[]; ns?: string }) {
  return (
    <div className="inline-flex items-center gap-4 px-4 py-1.5 rounded-full bg-[hsla(220,14%,4%,0.6)] border border-[hsla(215,100%,60%,0.14)] backdrop-blur-xl">
      {items.map((item, i) => (
        <div key={item.code} className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[hsl(215,100%,60%)]"
            style={{ animation: `${ns}Tick 2.4s ease-in-out infinite`, animationDelay: `${i * 0.4}s` }}
          />
          <span className="text-[10px] uppercase tracking-[0.32em] text-white/55 font-mono">
            {item.code} <span className="text-white/30">/</span> {item.label}
          </span>
        </div>
      ))}
    </div>
  );
});
