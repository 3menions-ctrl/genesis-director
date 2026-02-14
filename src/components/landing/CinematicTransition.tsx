/**
 * CinematicTransition - The APEX STUDIOS Signature Brand Animation
 * 
 * A 5-second cinematic intro using the actual Apex Studio logo and
 * the Studio Dark design system colors.
 * Phases: Void → Supernova → Forge → Brand Stamp → Portal Entry
 */

import { memo, forwardRef, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import logoImage from '@/assets/apex-studio-logo.png';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const TOTAL_DURATION = 5000;

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete }, ref) {
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState(0);

    const particles = useMemo(() =>
      Array.from({ length: 50 }, () => ({
        angle: Math.random() * 360,
        dist: 40 + Math.random() * 80,
        size: 1.5 + Math.random() * 3,
        speed: 0.5 + Math.random() * 1.5,
        delay: Math.random() * 0.8,
      })), []
    );

    const warpLines = useMemo(() =>
      Array.from({ length: 28 }, (_, i) => ({
        angle: (360 / 28) * i + Math.random() * 6,
        length: 60 + Math.random() * 40,
        width: 1 + Math.random() * 2,
        delay: Math.random() * 0.3,
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
        setProgress(t);

        if (t > 0.08 && t <= 0.30) setPhase(2);
        else if (t > 0.30 && t <= 0.55) setPhase(3);
        else if (t > 0.55 && t <= 0.82) setPhase(4);
        else if (t > 0.82) setPhase(5);

        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          stableOnComplete();
        }
      }, TOTAL_DURATION + 200);

      return () => clearTimeout(timer);
    }, [isActive, stableOnComplete]);

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'hsl(250, 15%, 4%)', /* --background */
          overflow: 'hidden',
        }}
      >
        {/* ═══ PHASE 1: VOID — Ignition point ═══ */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8, height: 8,
          borderRadius: '50%',
          background: 'hsl(263, 70%, 58%)', /* --primary */
          boxShadow: '0 0 40px 15px hsla(263,70%,58%,0.8), 0 0 80px 30px hsla(263,70%,58%,0.4), 0 0 120px 50px hsla(250,20%,16%,0.3)',
          opacity: phase >= 1 ? 1 : 0,
          animation: phase >= 1 ? 'apex-ignite 0.4s ease-out forwards' : 'none',
        }} />

        {/* ═══ PHASE 2: SUPERNOVA — Explosion ═══ */}
        {phase >= 2 && (
          <>
            {/* Nova rings */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 140, height: 140, borderRadius: '50%',
              border: '2px solid hsla(263,70%,58%,0.5)',
              animation: 'apex-nova-expand 1.4s ease-out forwards',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 100, height: 100, borderRadius: '50%',
              border: '1.5px solid hsla(263,70%,70%,0.35)',
              animation: 'apex-nova-expand 1.8s 0.15s ease-out forwards',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 60, height: 60, borderRadius: '50%',
              border: '1px solid hsla(195,90%,50%,0.25)', /* --accent cyan */
              animation: 'apex-nova-expand 2s 0.3s ease-out forwards',
            }} />

            {/* Radial light rays */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 1000, height: 1000,
              animation: 'apex-burst-rotate 20s linear infinite',
            }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={`burst-${i}`} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: i % 3 === 0 ? 2 : 1,
                  height: 450,
                  background: i % 4 === 0
                    ? 'linear-gradient(to top, hsla(195,90%,50%,0.15), transparent 60%)' /* cyan accent rays */
                    : `linear-gradient(to top, hsla(263,70%,58%,${0.15 + (i % 3) * 0.08}), transparent 65%)`,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${(360 / 20) * i}deg)`,
                  animation: `apex-ray-in 0.9s ${i * 0.025}s ease-out both`,
                }} />
              ))}
            </div>

            {/* Massive glow bloom */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 800, height: 800, borderRadius: '50%',
              background: 'radial-gradient(circle, hsla(263,70%,58%,0.35) 0%, hsla(250,20%,16%,0.2) 30%, transparent 60%)',
              filter: 'blur(40px)',
              animation: 'apex-bloom 1.2s ease-out forwards',
            }} />

            {/* Swirling particles */}
            {particles.map((p, i) => (
              <div key={`sp-${i}`} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: p.size, height: p.size, borderRadius: '50%',
                background: i % 5 === 0 ? 'hsla(195,90%,50%,0.7)' : 'hsla(263,70%,75%,0.8)',
                boxShadow: i % 5 === 0
                  ? '0 0 6px hsla(195,90%,50%,0.5)'
                  : '0 0 5px hsla(263,70%,58%,0.4)',
                animation: `apex-swirl ${p.speed + 1}s ${p.delay}s ease-in-out forwards`,
                transform: `rotate(${p.angle}deg) translateY(-${p.dist}px)`,
                opacity: 0,
              }} />
            ))}
          </>
        )}

        {/* ═══ PHASE 3: FORGE — Logo materializes ═══ */}
        <div style={{
          position: 'relative', zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}>
          {/* Actual Apex Studio Logo */}
          <div style={{
            marginBottom: 28,
            animation: phase >= 3 ? 'apex-forge-in 1.2s ease-out forwards' : 'none',
            opacity: phase >= 3 ? 1 : 0,
          }}>
            <div style={{ position: 'relative' }}>
              <img
                src={logoImage}
                alt="Apex Studio"
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'contain',
                  filter: phase >= 4
                    ? 'drop-shadow(0 0 30px hsla(263,70%,58%,0.6)) drop-shadow(0 0 60px hsla(263,70%,58%,0.3))'
                    : 'drop-shadow(0 0 20px hsla(263,70%,58%,0.5)) brightness(1.3)',
                  transition: 'filter 0.8s ease',
                }}
              />
              {/* Glowing ring behind logo */}
              <div style={{
                position: 'absolute', inset: -20,
                borderRadius: '50%',
                border: '1.5px solid hsla(263,70%,58%,0.25)',
                animation: phase >= 3 ? 'apex-logo-ring 3s linear infinite' : 'none',
              }} />
              <div style={{
                position: 'absolute', inset: -35,
                borderRadius: '50%',
                border: '1px solid hsla(263,70%,70%,0.12)',
                animation: phase >= 3 ? 'apex-logo-ring-reverse 5s linear infinite' : 'none',
              }} />
            </div>
          </div>

          {/* APEX text */}
          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-reveal 1s 0.4s ease-out both' : 'none',
          }}>
            <h1 style={{
              fontSize: 56,
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

          {/* STUDIOS subtitle */}
          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-reveal 0.8s 0.7s ease-out both' : 'none',
          }}>
            <p style={{
              fontSize: 16,
              fontWeight: 400,
              letterSpacing: '0.7em',
              color: 'hsla(263,70%,75%,0.6)',
              textTransform: 'uppercase',
              marginTop: 8,
              fontFamily: "'Sora', sans-serif",
            }}>
              Studios
            </p>
          </div>

          {/* ═══ PHASE 4: BRAND STAMP — The "ta-dum" ═══ */}
          {phase >= 4 && (
            <>
              {/* Horizontal accent line */}
              <div style={{
                width: 80, height: 1,
                background: 'linear-gradient(90deg, transparent, hsla(263,70%,58%,0.5), hsla(195,90%,50%,0.3), transparent)',
                marginTop: 24,
                animation: 'apex-line-expand 0.6s ease-out forwards',
              }} />

              {/* Tagline */}
              <p style={{
                fontSize: 12,
                fontWeight: 300,
                letterSpacing: '0.35em',
                color: 'hsla(240,5%,55%,0.7)', /* --muted-foreground */
                textTransform: 'uppercase',
                marginTop: 16,
                animation: 'apex-tagline-in 0.8s 0.2s ease-out both',
                fontFamily: "'Instrument Sans', sans-serif",
              }}>
                Where Stories Come Alive
              </p>

              {/* Stamp shockwave */}
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 200, height: 200, borderRadius: '50%',
                border: '1.5px solid hsla(263,70%,58%,0.35)',
                animation: 'apex-stamp-wave 1.2s ease-out forwards',
                zIndex: 5,
              }} />
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 160, height: 160, borderRadius: '50%',
                border: '1px solid hsla(195,90%,50%,0.2)', /* cyan accent ring */
                animation: 'apex-stamp-wave 1.5s 0.15s ease-out forwards',
                zIndex: 5,
              }} />

              {/* Logo glow pulse — the "ta-dum" moment */}
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, hsla(263,70%,58%,0.12) 0%, transparent 55%)',
                animation: 'apex-thud-glow 1s ease-out forwards',
                zIndex: 5,
              }} />
            </>
          )}
        </div>

        {/* ═══ PHASE 5: PORTAL ENTRY — Warp speed ═══ */}
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
                  background: i % 4 === 0
                    ? 'linear-gradient(to bottom, hsla(195,90%,50%,0.5), transparent)'
                    : 'linear-gradient(to bottom, hsla(263,70%,75%,0.5), transparent)',
                  transformOrigin: 'center top',
                  transform: `rotate(${w.angle}deg)`,
                  animation: `apex-warp ${0.5 + w.delay}s ${w.delay}s ease-in forwards`,
                  opacity: 0,
                }} />
              ))}
            </div>

            {/* Final flash to white */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'hsl(0,0%,100%)',
              animation: 'apex-flash 0.6s 0.35s ease-out forwards',
              opacity: 0,
            }} />
          </>
        )}

        <style>{`
          @keyframes apex-ignite {
            0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%,-50%) scale(4); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(2); opacity: 0.9; }
          }
          @keyframes apex-nova-expand {
            0% { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(10); opacity: 0; }
          }
          @keyframes apex-burst-rotate {
            from { transform: translate(-50%,-50%) rotate(0deg); }
            to { transform: translate(-50%,-50%) rotate(360deg); }
          }
          @keyframes apex-ray-in {
            0% { opacity: 0; height: 0; }
            50% { opacity: 1; }
            100% { opacity: 0.35; height: 450px; }
          }
          @keyframes apex-bloom {
            0% { transform: translate(-50%,-50%) scale(0.15); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          }
          @keyframes apex-swirl {
            0% { opacity: 0; transform: rotate(0deg) translateY(0); }
            30% { opacity: 1; }
            100% { opacity: 0; transform: rotate(220deg) translateY(-250px); }
          }
          @keyframes apex-forge-in {
            0% { transform: scale(0.3) translateY(30px); opacity: 0; filter: blur(15px) brightness(4); }
            50% { filter: blur(2px) brightness(1.8); }
            100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0) brightness(1); }
          }
          @keyframes apex-logo-ring {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes apex-logo-ring-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes apex-text-reveal {
            0% { transform: translateY(110%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes apex-text-shimmer {
            0% { background-position: -100% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes apex-line-expand {
            0% { width: 0; opacity: 0; }
            100% { width: 80px; opacity: 1; }
          }
          @keyframes apex-tagline-in {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes apex-stamp-wave {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
            100% { transform: translate(-50%,-50%) scale(6); opacity: 0; }
          }
          @keyframes apex-thud-glow {
            0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; }
            30% { opacity: 0.7; }
            100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0; }
          }
          @keyframes apex-warp {
            0% { opacity: 0; transform: rotate(var(--angle,0deg)) scaleY(0.1); }
            40% { opacity: 0.9; }
            100% { opacity: 0; transform: rotate(var(--angle,0deg)) scaleY(4); }
          }
          @keyframes apex-flash {
            0% { opacity: 0; }
            50% { opacity: 0.95; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
