/**
 * CinematicTransition - The APEX STUDIOS Signature Brand Animation
 * 
 * 10-second cinematic intro. Starts slow, accelerates to climax.
 * Uses the raw logo graphic (no container), fills the screen.
 * Phases: Void → Slow Burn → Supernova → Logo Forge → Brand Stamp → Warp Exit
 */

import { memo, forwardRef, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import logoGraphic from '@/assets/apex-logo.png';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const TOTAL_DURATION = 10000;

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete }, ref) {
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState(0);

    const particles = useMemo(() =>
      Array.from({ length: 60 }, () => ({
        angle: Math.random() * 360,
        dist: 50 + Math.random() * 120,
        size: 1.5 + Math.random() * 3.5,
        speed: 1 + Math.random() * 2,
        delay: Math.random() * 1.2,
      })), []
    );

    const warpLines = useMemo(() =>
      Array.from({ length: 36 }, (_, i) => ({
        angle: (360 / 36) * i + Math.random() * 5,
        length: 50 + Math.random() * 50,
        width: 1 + Math.random() * 2.5,
        delay: Math.random() * 0.25,
      })), []
    );

    const stableOnComplete = useCallback(onComplete, [onComplete]);

    useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
      if (!isActive) {
        hasNavigated.current = false;
        setProgress(0);
        setPhase(0);
        return;
      }

      const start = Date.now();
      setPhase(1);

      const tick = () => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - start;
        const t = Math.min(elapsed / TOTAL_DURATION, 1);
        // Slow start, accelerating curve: t^0.6 for first half, then speeds up
        const curved = t < 0.5
          ? Math.pow(t * 2, 0.6) * 0.5
          : 0.5 + Math.pow((t - 0.5) * 2, 1.8) * 0.5;
        setProgress(curved);

        // Phase timing (stretched for 10s)
        if (t <= 0.12) setPhase(1);       // Void & slow burn (0-1.2s)
        else if (t <= 0.30) setPhase(2);   // Supernova (1.2-3s)
        else if (t <= 0.55) setPhase(3);   // Logo forge (3-5.5s)
        else if (t <= 0.78) setPhase(4);   // Brand stamp (5.5-7.8s)
        else setPhase(5);                  // Warp exit (7.8-10s)

        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          stableOnComplete();
        }
      }, TOTAL_DURATION + 300);

      return () => clearTimeout(timer);
    }, [isActive, stableOnComplete]);

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'hsl(250, 15%, 4%)',
          overflow: 'hidden',
        }}
      >
        {/* ═══ PHASE 1: VOID — Slow breathing ember ═══ */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: 'hsl(263, 70%, 58%)',
          boxShadow: '0 0 60px 20px hsla(263,70%,58%,0.6), 0 0 120px 40px hsla(263,70%,58%,0.3)',
          opacity: phase >= 1 ? 1 : 0,
          animation: phase === 1 ? 'apex-ember 1.2s ease-in-out forwards' : phase >= 2 ? 'apex-ignite 0.5s ease-out forwards' : 'none',
        }} />

        {/* Slow breathing ambient glow during phase 1 */}
        {phase === 1 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, hsla(263,70%,58%,0.06) 0%, transparent 60%)',
            animation: 'apex-ambient-breathe 2s ease-in-out infinite',
          }} />
        )}

        {/* ═══ PHASE 2: SUPERNOVA — Explosive expansion ═══ */}
        {phase >= 2 && (
          <>
            {/* Triple nova rings */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 180, height: 180, borderRadius: '50%',
              border: '2.5px solid hsla(263,70%,58%,0.5)',
              animation: 'apex-nova-expand 2s ease-out forwards',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 120, height: 120, borderRadius: '50%',
              border: '1.5px solid hsla(263,70%,70%,0.3)',
              animation: 'apex-nova-expand 2.5s 0.2s ease-out forwards',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 80, height: 80, borderRadius: '50%',
              border: '1px solid hsla(195,90%,50%,0.2)',
              animation: 'apex-nova-expand 3s 0.4s ease-out forwards',
            }} />

            {/* 24 light rays */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100vmax', height: '100vmax',
              animation: 'apex-burst-rotate 25s linear infinite',
            }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={`ray-${i}`} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: i % 3 === 0 ? 2.5 : 1.2,
                  height: '50%',
                  background: i % 5 === 0
                    ? 'linear-gradient(to top, hsla(195,90%,50%,0.12), transparent 55%)'
                    : `linear-gradient(to top, hsla(263,70%,58%,${0.12 + (i % 3) * 0.06}), transparent 60%)`,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${(360 / 24) * i}deg)`,
                  animation: `apex-ray-in 1.5s ${i * 0.04}s ease-out both`,
                }} />
              ))}
            </div>

            {/* Full-screen bloom */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '120vmax', height: '120vmax', borderRadius: '50%',
              background: 'radial-gradient(circle, hsla(263,70%,58%,0.25) 0%, hsla(250,20%,16%,0.1) 25%, transparent 55%)',
              filter: 'blur(60px)',
              animation: 'apex-bloom 2s ease-out forwards',
            }} />

            {/* Swirling particles */}
            {particles.map((p, i) => (
              <div key={`sp-${i}`} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: p.size, height: p.size, borderRadius: '50%',
                background: i % 6 === 0 ? 'hsla(195,90%,50%,0.7)' : 'hsla(263,70%,75%,0.7)',
                boxShadow: i % 6 === 0
                  ? '0 0 8px hsla(195,90%,50%,0.5)'
                  : '0 0 6px hsla(263,70%,58%,0.4)',
                animation: `apex-swirl ${p.speed + 1.5}s ${p.delay}s ease-in-out forwards`,
                transform: `rotate(${p.angle}deg) translateY(-${p.dist}px)`,
                opacity: 0,
              }} />
            ))}
          </>
        )}

        {/* ═══ PHASE 3: FORGE — Logo fills the screen ═══ */}
        <div style={{
          position: 'relative', zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}>
          {/* Logo — large, raw graphic, no container */}
          <div style={{
            animation: phase >= 3 ? 'apex-logo-forge 2s ease-out forwards' : 'none',
            opacity: phase >= 3 ? 1 : 0,
          }}>
            <img
              src={logoGraphic}
              alt="Apex Studio"
              style={{
                width: '45vmin',
                height: '45vmin',
                maxWidth: 400,
                maxHeight: 400,
                objectFit: 'contain',
                filter: phase >= 4
                  ? 'drop-shadow(0 0 50px hsla(263,70%,58%,0.5)) drop-shadow(0 0 100px hsla(263,70%,58%,0.25)) drop-shadow(0 0 150px hsla(250,20%,16%,0.3))'
                  : 'drop-shadow(0 0 30px hsla(263,70%,58%,0.6)) brightness(1.5)',
                transition: 'filter 1s ease',
                animation: phase >= 4 ? 'apex-logo-pulse 2s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* APEX text — big */}
          <div style={{
            overflow: 'hidden',
            marginTop: 32,
            animation: phase >= 3 ? 'apex-text-reveal 1.2s 0.6s ease-out both' : 'none',
          }}>
            <h1 style={{
              fontSize: 'clamp(48px, 10vw, 80px)',
              fontWeight: 200,
              letterSpacing: '0.5em',
              color: 'transparent',
              backgroundImage: 'linear-gradient(135deg, hsl(240,5%,90%) 0%, hsl(0,0%,100%) 40%, hsl(263,70%,75%) 80%, hsl(263,70%,58%) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              textTransform: 'uppercase',
              fontFamily: "'Sora', sans-serif",
              lineHeight: 1,
              animation: phase >= 4 ? 'apex-text-shimmer 3s ease-in-out infinite' : 'none',
              backgroundSize: '200% 100%',
            }}>
              Apex
            </h1>
          </div>

          {/* STUDIOS */}
          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-reveal 1s 1s ease-out both' : 'none',
          }}>
            <p style={{
              fontSize: 'clamp(14px, 2.5vw, 20px)',
              fontWeight: 400,
              letterSpacing: '0.8em',
              color: 'hsla(263,70%,75%,0.55)',
              textTransform: 'uppercase',
              marginTop: 10,
              fontFamily: "'Sora', sans-serif",
            }}>
              Studios
            </p>
          </div>

          {/* ═══ PHASE 4: BRAND STAMP ═══ */}
          {phase >= 4 && (
            <>
              <div style={{
                width: 100, height: 1,
                background: 'linear-gradient(90deg, transparent, hsla(263,70%,58%,0.45), hsla(195,90%,50%,0.25), transparent)',
                marginTop: 28,
                animation: 'apex-line-expand 0.8s ease-out forwards',
              }} />

              <p style={{
                fontSize: 'clamp(10px, 1.5vw, 14px)',
                fontWeight: 300,
                letterSpacing: '0.4em',
                color: 'hsla(240,5%,55%,0.6)',
                textTransform: 'uppercase',
                marginTop: 18,
                animation: 'apex-tagline-in 1s 0.3s ease-out both',
                fontFamily: "'Instrument Sans', sans-serif",
              }}>
                Where Stories Come Alive
              </p>

              {/* Shockwaves */}
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 250, height: 250, borderRadius: '50%',
                border: '2px solid hsla(263,70%,58%,0.3)',
                animation: 'apex-stamp-wave 1.5s ease-out forwards',
                zIndex: 5,
              }} />
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200, height: 200, borderRadius: '50%',
                border: '1px solid hsla(195,90%,50%,0.15)',
                animation: 'apex-stamp-wave 2s 0.2s ease-out forwards',
                zIndex: 5,
              }} />
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 150, height: 150, borderRadius: '50%',
                border: '1px solid hsla(263,70%,70%,0.2)',
                animation: 'apex-stamp-wave 2.5s 0.4s ease-out forwards',
                zIndex: 5,
              }} />

              {/* Deep glow thud */}
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80vmin', height: '80vmin', borderRadius: '50%',
                background: 'radial-gradient(circle, hsla(263,70%,58%,0.1) 0%, transparent 50%)',
                animation: 'apex-thud-glow 1.2s ease-out forwards',
                zIndex: 5,
              }} />
            </>
          )}
        </div>

        {/* ═══ PHASE 5: WARP EXIT ═══ */}
        {phase >= 5 && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 40,
            }}>
              {warpLines.map((w, i) => (
                <div key={`warp-${i}`} style={{
                  position: 'absolute',
                  width: w.width,
                  height: `${w.length}%`,
                  background: i % 5 === 0
                    ? 'linear-gradient(to bottom, hsla(195,90%,50%,0.5), transparent)'
                    : 'linear-gradient(to bottom, hsla(263,70%,75%,0.45), transparent)',
                  transformOrigin: 'center top',
                  transform: `rotate(${w.angle}deg)`,
                  animation: `apex-warp ${0.6 + w.delay}s ${w.delay}s ease-in forwards`,
                  opacity: 0,
                }} />
              ))}
            </div>

            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'hsl(0,0%,100%)',
              animation: 'apex-flash 0.7s 0.5s ease-out forwards',
              opacity: 0,
            }} />
          </>
        )}

        <style>{`
          @keyframes apex-ember {
            0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
            50% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
            100% { transform: translate(-50%,-50%) scale(0.8); opacity: 1; }
          }
          @keyframes apex-ambient-breathe {
            0%, 100% { opacity: 0.3; transform: translate(-50%,-50%) scale(0.9); }
            50% { opacity: 0.7; transform: translate(-50%,-50%) scale(1.1); }
          }
          @keyframes apex-ignite {
            0% { transform: translate(-50%,-50%) scale(1); }
            50% { transform: translate(-50%,-50%) scale(5); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(3); opacity: 0.8; }
          }
          @keyframes apex-nova-expand {
            0% { transform: translate(-50%,-50%) scale(0.3); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(12); opacity: 0; }
          }
          @keyframes apex-burst-rotate {
            from { transform: translate(-50%,-50%) rotate(0deg); }
            to { transform: translate(-50%,-50%) rotate(360deg); }
          }
          @keyframes apex-ray-in {
            0% { opacity: 0; height: 0; }
            40% { opacity: 1; }
            100% { opacity: 0.3; height: 50%; }
          }
          @keyframes apex-bloom {
            0% { transform: translate(-50%,-50%) scale(0.1); opacity: 0; }
            40% { opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          }
          @keyframes apex-swirl {
            0% { opacity: 0; transform: rotate(0deg) translateY(0); }
            20% { opacity: 1; }
            100% { opacity: 0; transform: rotate(250deg) translateY(-300px); }
          }
          @keyframes apex-logo-forge {
            0% { transform: scale(0.15); opacity: 0; filter: blur(25px) brightness(5); }
            30% { filter: blur(8px) brightness(2.5); }
            60% { filter: blur(2px) brightness(1.5); }
            100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
          }
          @keyframes apex-logo-pulse {
            0%, 100% { filter: drop-shadow(0 0 50px hsla(263,70%,58%,0.5)) drop-shadow(0 0 100px hsla(263,70%,58%,0.25)); }
            50% { filter: drop-shadow(0 0 70px hsla(263,70%,58%,0.65)) drop-shadow(0 0 140px hsla(263,70%,58%,0.35)); }
          }
          @keyframes apex-text-reveal {
            0% { transform: translateY(120%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes apex-text-shimmer {
            0% { background-position: -100% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes apex-line-expand {
            0% { width: 0; opacity: 0; }
            100% { width: 100px; opacity: 1; }
          }
          @keyframes apex-tagline-in {
            0% { opacity: 0; transform: translateY(12px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes apex-stamp-wave {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
            100% { transform: translate(-50%,-50%) scale(8); opacity: 0; }
          }
          @keyframes apex-thud-glow {
            0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
            25% { opacity: 0.6; }
            100% { transform: translate(-50%,-50%) scale(2); opacity: 0; }
          }
          @keyframes apex-warp {
            0% { opacity: 0; transform: rotate(var(--angle,0deg)) scaleY(0.05); }
            35% { opacity: 0.9; }
            100% { opacity: 0; transform: rotate(var(--angle,0deg)) scaleY(5); }
          }
          @keyframes apex-flash {
            0% { opacity: 0; }
            60% { opacity: 0.95; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
