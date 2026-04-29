/**
 * CinemaLoader - Ultra-minimalist premium loading component
 * 
 * THE SINGLE SOURCE OF TRUTH for all loading states in the application.
 * 
 * Design: Apple-level minimalism. Single breathing ring, clean typography,
 * hairline progress bar. Nothing else. The restraint IS the premium feel.
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

export const CinemaLoader = memo(forwardRef<HTMLDivElement, CinemaLoaderProps>(
  function CinemaLoader({
    message = 'Loading...',
    progress = 0,
    showProgress = true,
    isVisible = true,
    onExitComplete,
    className,
    variant = 'fullscreen',
  }, ref) {
    const [isExiting, setIsExiting] = useState(false);
    const [isHidden, setIsHidden] = useState(!isVisible);
    const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        }, 400);
      }
      return () => { if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current); };
    }, [isVisible, onExitComplete]);

    if (isHidden && !isVisible) return null;

    const containerClasses = cn(
      "flex items-center justify-center overflow-hidden",
      variant === 'fullscreen' && "fixed inset-0 z-[9999]",
      variant === 'overlay' && "absolute inset-0 z-50",
      variant === 'inline' && "relative w-full min-h-[400px]",
      className
    );

    const displayProgress = Math.max(progress, 2);

    return (
      <div
        ref={ref}
        className={containerClasses}
        style={{
          backgroundColor: 'hsl(220, 14%, 2%)',
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: isExiting ? 0 : 1,
        }}
      >
        {/* Layer 1 — Deep base wash with cool blue undertone */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(1200px 700px at 50% 38%, hsla(215, 95%, 26%, 0.18), transparent 62%),' +
              'radial-gradient(900px 540px at 100% 110%, hsla(210, 80%, 18%, 0.12), transparent 58%),' +
              'radial-gradient(700px 480px at 0% 100%, hsla(220, 70%, 12%, 0.14), transparent 60%),' +
              'linear-gradient(180deg, hsl(220, 16%, 3.4%) 0%, hsl(220, 14%, 2%) 100%)',
          }}
        />

        {/* Layer 2 — Slow conic aurora sweep */}
        <div
          className="absolute -inset-[20%] pointer-events-none opacity-[0.16]"
          style={{
            background:
              'conic-gradient(from 0deg at 50% 50%, transparent 0deg, hsla(215,100%,60%,0.28) 60deg, transparent 130deg, hsla(210,100%,55%,0.18) 220deg, transparent 300deg, hsla(215,100%,60%,0.22) 360deg)',
            filter: 'blur(80px)',
            animation: 'loaderAurora 50s linear infinite',
          }}
        />

        {/* Layer 3 — Edge vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, hsla(220,30%,1%,0.7) 100%)',
          }}
        />

        {/* Layer 4 — Film grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
          }}
        />

        {/* Top + bottom luminous hairlines */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.5) 50%, transparent 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, hsla(215,100%,60%,0.35) 50%, transparent 100%)',
          }}
        />

        {/* Core content */}
        <div
          className="relative z-10 flex flex-col items-center gap-12 px-6"
          style={{
            transition: 'opacity 0.5s ease, transform 0.5s ease',
            opacity: isExiting ? 0 : 1,
            transform: isExiting ? 'scale(0.97) translateY(8px)' : 'scale(1) translateY(0)',
          }}
        >
          {/* Concentric halo system — premium logo mark */}
          <div className="relative w-32 h-32">
            {/* Pulsing inner aura */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, hsla(215,100%,55%,0.35) 0%, hsla(215,100%,42%,0.12) 35%, transparent 70%)',
                animation: 'loaderAura 3.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                filter: 'blur(8px)',
              }}
            />

            {/* Outer rotating ring with orbital pip */}
            <svg
              viewBox="0 0 128 128"
              className="absolute inset-0 w-full h-full"
              style={{ animation: 'loaderSpin 14s linear infinite' }}
            >
              <defs>
                <linearGradient id="cinemaRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                  <stop offset="50%" stopColor="hsla(215,100%,65%,0.6)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                </linearGradient>
              </defs>
              <circle
                cx="64" cy="64" r="62"
                fill="none"
                stroke="url(#cinemaRingGrad)"
                strokeWidth="0.75"
              />
              {/* Orbital pip */}
              <circle cx="64" cy="2" r="2.2" fill="hsl(215,100%,70%)">
                <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>

            {/* Counter-rotating dashed arc */}
            <svg
              viewBox="0 0 128 128"
              className="absolute inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]"
              style={{ animation: 'loaderSpinReverse 22s linear infinite' }}
            >
              <circle
                cx="64" cy="64" r="58"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="0.5"
                strokeDasharray="2 6"
              />
            </svg>

            {/* Progress arc */}
            <svg
              viewBox="0 0 128 128"
              className="absolute inset-0 w-full h-full -rotate-90"
            >
              <circle
                cx="64" cy="64" r="50"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <circle
                cx="64" cy="64" r="50"
                fill="none"
                stroke="hsla(215,100%,68%,0.85)"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeDasharray={`${displayProgress * 3.1416} ${314.16 - displayProgress * 3.1416}`}
                style={{
                  transition: 'stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: 'drop-shadow(0 0 6px hsla(215,100%,60%,0.55))',
                }}
              />
            </svg>

            {/* Inner mark — refined wordmark glyph */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="relative flex items-center justify-center w-9 h-9 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle at 30% 30%, hsla(215,100%,75%,0.35), hsla(215,100%,42%,0.1) 60%, transparent 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 24px -2px hsla(215,100%,55%,0.5)',
                }}
              >
                <span
                  className="text-white/90 font-light tracking-tight"
                  style={{ fontSize: '14px', lineHeight: 1, fontFamily: 'Sora, system-ui, sans-serif' }}
                >
                  A
                </span>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ animation: 'loaderPulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
                />
              </div>
            </div>
          </div>

          {/* Text block */}
          <div className="flex flex-col items-center gap-6">
            {/* Brand wordmark */}
            <div className="flex items-center gap-3">
              <div
                className="h-px w-10"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, hsla(215,100%,65%,0.55))',
                }}
              />
              <p
                className="text-white/85 text-[11px] font-medium tracking-[0.45em] uppercase"
                style={{ fontFamily: 'Sora, system-ui, sans-serif' }}
              >
                Apex Studio
              </p>
              <div
                className="h-px w-10"
                style={{
                  background:
                    'linear-gradient(90deg, hsla(215,100%,65%,0.55), transparent)',
                }}
              />
            </div>

            {/* Message */}
            <p className="text-white/55 text-[12px] font-light tracking-[0.28em] uppercase text-center min-h-[1em]">
              {message}
            </p>

            {/* Progress bar */}
            {showProgress && (
              <div className="w-64">
                <div
                  className="relative h-[2px] w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                >
                  <div
                    className="relative h-full rounded-full"
                    style={{
                      width: `${displayProgress}%`,
                      background:
                        'linear-gradient(90deg, hsla(215,100%,55%,0.65) 0%, hsla(215,100%,75%,0.95) 60%, rgba(255,255,255,0.95) 100%)',
                      boxShadow:
                        '0 0 12px hsla(215,100%,60%,0.6), 0 0 2px rgba(255,255,255,0.8)',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* End-cap glow */}
                    <div
                      className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        boxShadow:
                          '0 0 10px hsla(215,100%,70%,0.9), 0 0 18px hsla(215,100%,55%,0.6)',
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2.5">
                  <span className="text-[9px] text-white/30 font-mono tracking-[0.25em] uppercase">
                    Loading
                  </span>
                  <span className="text-[10px] text-white/45 font-mono tabular-nums tracking-wider">
                    {String(Math.round(displayProgress)).padStart(3, '0')}%
                  </span>
                </div>
              </div>
            )}

            {/* Diagnostic ticker */}
            <div className="flex items-center gap-5 mt-2">
              {['Engine', 'Codecs', 'Timeline'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: 'hsla(215,100%,65%,0.85)',
                      boxShadow: '0 0 6px hsla(215,100%,65%,0.7)',
                      animation: `loaderTick 1.4s cubic-bezier(0.4, 0, 0.6, 1) ${i * 0.25}s infinite`,
                    }}
                  />
                  <span className="text-[9px] text-white/35 font-mono tracking-[0.2em] uppercase">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer signature */}
          <div className="flex items-center gap-3 mt-2">
            <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18))' }} />
            <span className="text-[9px] text-white/25 font-mono tracking-[0.4em] uppercase">
              Cinema · Engineered
            </span>
            <div className="h-px w-8" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18), transparent)' }} />
          </div>
        </div>

        {/* Keyframes */}
        <style>{`
          @keyframes loaderSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes loaderSpinReverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes loaderAurora {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes loaderAura {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 0.95; transform: scale(1.08); }
          }
          @keyframes loaderPulse {
            0%, 100% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
            50% { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22), 0 0 18px hsla(215,100%,60%,0.4); }
          }
          @keyframes loaderTick {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.4); }
          }
        `}</style>
      </div>
    );
  }
));

CinemaLoader.displayName = 'CinemaLoader';
export default CinemaLoader;
