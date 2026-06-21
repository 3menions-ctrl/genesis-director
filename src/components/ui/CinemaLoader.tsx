/**
 * CinemaLoader — the single source of truth for all loading states.
 *
 * v3 "Render Core" — a game-grade futuristic boot sequence. A nested
 * counter-rotating hex reactor with orbiting energy nodes, a segmented
 * progress ring, a scanline sweep, and a rotating boot-status ticker.
 * Pure CSS keyframes + SVG — no new dependencies, GPU-cheap, and fully
 * reduced-motion aware.
 *
 * The props API is unchanged from v2 so every call site keeps working:
 *   message · progress · showProgress · isVisible · onExitComplete ·
 *   className · variant ('fullscreen' | 'inline' | 'overlay')
 */

import { memo, useEffect, useRef, forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CinemaLoaderProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
  isVisible?: boolean;
  onExitComplete?: () => void;
  className?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
}

// Boot-sequence phrases that rotate while indeterminate. Reads like a
// render engine spinning up — gives the wait narrative momentum.
const BOOT_PHRASES = [
  'Initializing render core',
  'Warming neural codecs',
  'Synchronizing timeline',
  'Calibrating color science',
  'Allocating GPU lanes',
  'Linking the bridge',
];

export const CinemaLoader = memo(forwardRef<HTMLDivElement, CinemaLoaderProps>(
  function CinemaLoader({
    message,
    progress = 0,
    showProgress = true,
    isVisible = true,
    onExitComplete,
    className,
    variant = 'fullscreen',
  }, ref) {
    const [isExiting, setIsExiting] = useState(false);
    const [isHidden, setIsHidden] = useState(!isVisible);
    const [phraseIdx, setPhraseIdx] = useState(0);
    const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
      if (isVisible) {
        setIsHidden(false);
        setIsExiting(false);
      } else {
        setIsExiting(true);
        if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = setTimeout(() => {
          setIsHidden(true);
          onExitComplete?.();
        }, 450);
      }
      return () => { if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current); };
    }, [isVisible, onExitComplete]);

    // Rotate the boot ticker only when no explicit message is supplied.
    useEffect(() => {
      if (message || reducedMotion) return;
      const id = setInterval(() => {
        setPhraseIdx((i) => (i + 1) % BOOT_PHRASES.length);
      }, 2000);
      return () => clearInterval(id);
    }, [message, reducedMotion]);

    if (isHidden && !isVisible) return null;

    const containerClasses = cn(
      'flex items-center justify-center overflow-hidden',
      variant === 'fullscreen' && 'fixed inset-0 z-[9999]',
      variant === 'overlay' && 'absolute inset-0 z-50',
      variant === 'inline' && 'relative w-full min-h-[400px]',
      className,
    );

    const displayProgress = Math.max(progress, 2);
    const statusText = message ?? BOOT_PHRASES[phraseIdx];

    // Segmented progress ring geometry.
    const R = 54;
    const CIRC = 2 * Math.PI * R;

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={{
          backgroundColor: 'hsl(222 18% 2.5%)',
          transition: 'opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isExiting ? 0 : 1,
        }}
      >
        {/* Layer 1 — deep base wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(1200px 700px at 50% 36%, hsla(215,95%,28%,0.20), transparent 62%),' +
              'radial-gradient(900px 540px at 100% 110%, hsla(265,80%,22%,0.14), transparent 58%),' +
              'radial-gradient(720px 480px at 0% 100%, hsla(200,80%,16%,0.16), transparent 60%),' +
              'linear-gradient(180deg, hsl(222 20% 4%) 0%, hsl(222 18% 2.5%) 100%)',
          }}
        />

        {/* Layer 2 — animated hex grid (the "holodeck floor") */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'><path d='M28 0 L56 16 L56 50 L28 66 L0 50 L0 16 Z' fill='none' stroke='%234aa3ff' stroke-width='0.6'/></svg>\")",
            backgroundSize: '56px 100px',
            maskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 72%)',
            animation: reducedMotion ? undefined : 'loaderGridDrift 24s linear infinite',
          }}
        />

        {/* Layer 3 — slow conic aurora */}
        <div
          className="absolute -inset-[20%] pointer-events-none opacity-[0.18]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.30) 60deg, transparent 130deg, hsla(265,100%,62%,0.20) 220deg, transparent 300deg, hsla(190,100%,58%,0.22) 360deg)',
            filter: 'blur(80px)',
            animation: reducedMotion ? undefined : 'loaderAurora 46s linear infinite',
          }}
        />

        {/* Layer 4 — scanline sweep */}
        {!reducedMotion && (
          <div
            className="absolute inset-x-0 h-[40%] pointer-events-none opacity-[0.06]"
            style={{
              background:
                'linear-gradient(180deg, transparent, hsla(200,100%,70%,0.9), transparent)',
              animation: 'loaderScan 4.5s cubic-bezier(0.4,0,0.2,1) infinite',
            }}
          />
        )}

        {/* Edge vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 48%, hsla(222,30%,1%,0.75) 100%)',
          }}
        />

        {/* Luminous top/bottom hairlines */}
        <div className="absolute top-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, hsla(200,100%,62%,0.55), transparent)' }} />
        <div className="absolute bottom-0 inset-x-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, hsla(265,100%,62%,0.4), transparent)' }} />

        {/* ───────────────── Core content ───────────────── */}
        <div
          className="relative z-10 flex flex-col items-center gap-10 px-6"
          style={{
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? 'scale(0.96) translateY(10px)' : 'scale(1) translateY(0)',
          }}
        >
          {/* The Render Core */}
          <div className="relative w-40 h-40">
            {/* Energy aura */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, hsla(200,100%,58%,0.34) 0%, hsla(215,100%,45%,0.12) 38%, transparent 70%)',
                filter: 'blur(10px)',
                animation: reducedMotion ? undefined : 'loaderAura 3.6s cubic-bezier(0.4,0,0.6,1) infinite',
              }}
            />

            {/* Orbiting energy nodes */}
            {!reducedMotion && (
              <div
                className="absolute inset-0"
                style={{ animation: 'loaderSpin 9s linear infinite' }}
              >
                {[0, 120, 240].map((deg) => (
                  <span
                    key={deg}
                    className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                    style={{
                      background: 'hsl(200 100% 75%)',
                      boxShadow: '0 0 10px hsla(200,100%,70%,0.9), 0 0 20px hsla(200,100%,55%,0.5)',
                      transform: `rotate(${deg}deg) translateY(-76px)`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Outer hexagon — rotating */}
            <svg
              viewBox="0 0 160 160"
              className="absolute inset-0 w-full h-full"
              style={{ animation: reducedMotion ? undefined : 'loaderSpin 18s linear infinite' }}
            >
              <defs>
                <linearGradient id="hexGradA" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                  <stop offset="50%" stopColor="hsla(200,100%,65%,0.7)" />
                  <stop offset="100%" stopColor="hsla(265,100%,65%,0.18)" />
                </linearGradient>
              </defs>
              <polygon
                points="80,8 142,44 142,116 80,152 18,116 18,44"
                fill="none"
                stroke="url(#hexGradA)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>

            {/* Inner hexagon — counter-rotating dashed */}
            <svg
              viewBox="0 0 160 160"
              className="absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
              style={{ animation: reducedMotion ? undefined : 'loaderSpinReverse 26s linear infinite' }}
            >
              <polygon
                points="80,8 142,44 142,116 80,152 18,116 18,44"
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="0.6"
                strokeDasharray="3 7"
                strokeLinejoin="round"
              />
            </svg>

            {/* Segmented progress ring */}
            <svg viewBox="0 0 160 160" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
              <circle
                cx="80" cy="80" r={R}
                fill="none"
                stroke="hsla(200,100%,68%,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${(displayProgress / 100) * CIRC} ${CIRC}`}
                style={{
                  transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)',
                  filter: 'drop-shadow(0 0 6px hsla(200,100%,62%,0.6))',
                }}
              />
            </svg>

            {/* Reactor core glyph */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative flex items-center justify-center w-12 h-12 rounded-2xl"
                style={{
                  background:
                    'radial-gradient(circle at 32% 28%, hsla(200,100%,78%,0.4), hsla(215,100%,42%,0.12) 60%, transparent 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(255,255,255,0.12), 0 0 28px -2px hsla(200,100%,58%,0.6)',
                  animation: reducedMotion ? undefined : 'loaderCorePulse 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
                }}
              >
                <span
                  className="font-light tracking-tight text-white/95"
                  style={{ fontSize: '18px', lineHeight: 1, fontFamily: 'Fraunces, serif', fontStyle: 'italic' }}
                >
                  sb
                </span>
              </div>
            </div>
          </div>

          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, transparent, hsla(200,100%,65%,0.55))' }} />
            <p className="text-white/85 text-[11px] font-medium tracking-[0.45em] uppercase"
              style={{ fontFamily: 'Sora, system-ui, sans-serif' }}>
              Small Bridges
            </p>
            <div className="h-px w-10" style={{ background: 'linear-gradient(90deg, hsla(265,100%,65%,0.55), transparent)' }} />
          </div>

          {/* Status line */}
          <p className="text-white/55 text-[12px] font-light tracking-[0.28em] uppercase text-center min-h-[1em]"
            style={{ transition: 'opacity 0.3s ease' }}>
            {statusText}
          </p>

          {/* Segmented power bar */}
          {showProgress && (
            <div className="w-72">
              <div className="flex gap-1">
                {Array.from({ length: 24 }).map((_, i) => {
                  const lit = (i / 24) * 100 <= displayProgress;
                  return (
                    <div
                      key={i}
                      className="h-2 flex-1 rounded-[1px]"
                      style={{
                        background: lit
                          ? 'linear-gradient(180deg, hsla(200,100%,78%,0.95), hsla(215,100%,58%,0.85))'
                          : 'rgba(255,255,255,0.05)',
                        boxShadow: lit ? '0 0 8px hsla(200,100%,62%,0.55)' : 'none',
                        transition: 'background 0.4s ease, box-shadow 0.4s ease',
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between items-center mt-2.5">
                <span className="text-[9px] text-white/30 font-mono tracking-[0.25em] uppercase">
                  Render core
                </span>
                <span className="text-[10px] text-white/50 font-mono tabular-nums tracking-wider">
                  {String(Math.round(displayProgress)).padStart(3, '0')}%
                </span>
              </div>
            </div>
          )}

          {/* Diagnostic ticker */}
          <div className="flex items-center gap-5">
            {['Engine', 'Codecs', 'Timeline'].map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: 'hsla(200,100%,68%,0.85)',
                    boxShadow: '0 0 6px hsla(200,100%,65%,0.7)',
                    animation: reducedMotion ? undefined : `loaderTick 1.4s cubic-bezier(0.4,0,0.6,1) ${i * 0.25}s infinite`,
                  }}
                />
                <span className="text-[9px] text-white/35 font-mono tracking-[0.2em] uppercase">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes loaderSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
          @keyframes loaderSpinReverse { from { transform: rotate(360deg); } to { transform: rotate(0); } }
          @keyframes loaderAurora { from { transform: rotate(0); } to { transform: rotate(360deg); } }
          @keyframes loaderGridDrift { from { background-position: 0 0; } to { background-position: 0 200px; } }
          @keyframes loaderScan { 0% { top: -40%; } 100% { top: 100%; } }
          @keyframes loaderAura { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.95; transform: scale(1.08); } }
          @keyframes loaderCorePulse { 0%,100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 24px -4px hsla(200,100%,55%,0.4); } 50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.24), 0 0 36px -2px hsla(200,100%,62%,0.7); } }
          @keyframes loaderTick { 0%,100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
        `}</style>
      </div>
    );
  },
));

CinemaLoader.displayName = 'CinemaLoader';
export default CinemaLoader;
