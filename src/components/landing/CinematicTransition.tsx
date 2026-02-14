/**
 * CinematicTransition - The APEX STUDIOS Signature Brand Animation
 * 
 * 10-second cinematic intro. Black, white, dark blue palette.
 * Uses apex-studio-logo.png (the white sign, no container).
 * Starts slow, accelerates. Ends with cinematic letterbox close, not white flash.
 */

import { memo, forwardRef, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import logoImage from '@/assets/apex-studio-logo.png';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const TOTAL_DURATION = 10000;

// Color palette: black, white, dark blue
const C = {
  bg: '#0a0a0f',           // --background
  white: '#ffffff',
  whiteHalf: 'rgba(255,255,255,0.5)',
  white20: 'rgba(255,255,255,0.2)',
  white10: 'rgba(255,255,255,0.1)',
  white06: 'rgba(255,255,255,0.06)',
  white03: 'rgba(255,255,255,0.03)',
  blue: '#1a2744',         // dark blue
  blueGlow: 'rgba(26,39,68,0.6)',
  blueBright: '#2a4070',
  blueLight: 'rgba(60,100,180,0.3)',
  blueSubtle: 'rgba(40,65,120,0.15)',
};

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete }, ref) {
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState(0);

    const particles = useMemo(() =>
      Array.from({ length: 70 }, () => ({
        angle: Math.random() * 360,
        dist: 40 + Math.random() * 150,
        size: 1 + Math.random() * 3,
        speed: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 1.5,
        isBlue: Math.random() > 0.6,
      })), []
    );

    const warpLines = useMemo(() =>
      Array.from({ length: 40 }, (_, i) => ({
        angle: (360 / 40) * i + Math.random() * 4,
        length: 50 + Math.random() * 50,
        width: 0.5 + Math.random() * 2,
        delay: Math.random() * 0.4,
        isBlue: Math.random() > 0.5,
      })), []
    );

    const starField = useMemo(() =>
      Array.from({ length: 80 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.5 + Math.random() * 2,
        dur: 1.5 + Math.random() * 3,
        delay: Math.random() * 3,
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
        // Slow start → fast end
        const curved = t < 0.5
          ? Math.pow(t * 2, 0.5) * 0.35
          : 0.35 + Math.pow((t - 0.5) * 2, 2.2) * 0.65;
        setProgress(curved);

        if (t <= 0.15) setPhase(1);       // Void & ember (0-1.5s)
        else if (t <= 0.32) setPhase(2);   // Supernova (1.5-3.2s)
        else if (t <= 0.58) setPhase(3);   // Logo forge (3.2-5.8s)
        else if (t <= 0.80) setPhase(4);   // Brand stamp (5.8-8s)
        else setPhase(5);                  // Warp exit (8-10s)

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
          background: C.bg,
          overflow: 'hidden',
        }}
      >
        {/* ═══ STAR FIELD — visible throughout ═══ */}
        {starField.map((s, i) => (
          <div key={`star-${i}`} style={{
            position: 'absolute',
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            borderRadius: '50%',
            background: C.white,
            animation: `apex-twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
            opacity: 0,
          }} />
        ))}

        {/* ═══ PHASE 1: VOID — Slow breathing ember ═══ */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: C.white,
          boxShadow: `0 0 40px 15px ${C.white20}, 0 0 80px 30px ${C.blueSubtle}, 0 0 140px 60px ${C.white06}`,
          opacity: phase >= 1 ? 1 : 0,
          animation: phase === 1 ? 'apex-ember 1.5s ease-in-out forwards' : phase >= 2 ? 'apex-ignite 0.6s ease-out forwards' : 'none',
        }} />

        {phase === 1 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: `radial-gradient(circle, ${C.blueSubtle} 0%, transparent 60%)`,
            animation: 'apex-ambient 2.5s ease-in-out infinite',
          }} />
        )}

        {/* ═══ PHASE 2: SUPERNOVA ═══ */}
        {phase >= 2 && (
          <>
            {/* Nova rings — white and dark blue */}
            {[200, 140, 90].map((size, i) => (
              <div key={`nova-${i}`} style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: size, height: size, borderRadius: '50%',
                border: `${2 - i * 0.5}px solid ${i === 2 ? C.blueLight : C.white20}`,
                animation: `apex-nova ${2 + i * 0.5}s ${i * 0.2}s ease-out forwards`,
              }} />
            ))}

            {/* 28 light rays — alternating white and dark blue */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100vmax', height: '100vmax',
              animation: 'apex-rotate 30s linear infinite',
            }}>
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={`ray-${i}`} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  width: i % 4 === 0 ? 2.5 : 1,
                  height: '50%',
                  background: i % 3 === 0
                    ? `linear-gradient(to top, ${C.blueLight}, transparent 50%)`
                    : `linear-gradient(to top, ${C.white10}, transparent 55%)`,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${(360 / 28) * i}deg)`,
                  animation: `apex-ray-in 1.8s ${i * 0.03}s ease-out both`,
                }} />
              ))}
            </div>

            {/* Full-screen bloom — dark blue tinted */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '130vmax', height: '130vmax', borderRadius: '50%',
              background: `radial-gradient(circle, ${C.blueGlow} 0%, ${C.blueSubtle} 20%, transparent 50%)`,
              filter: 'blur(80px)',
              animation: 'apex-bloom 2.5s ease-out forwards',
            }} />

            {/* Particles */}
            {particles.map((p, i) => (
              <div key={`p-${i}`} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: p.size, height: p.size, borderRadius: '50%',
                background: p.isBlue ? C.blueBright : C.white,
                boxShadow: p.isBlue ? `0 0 6px ${C.blueLight}` : `0 0 4px ${C.white20}`,
                animation: `apex-swirl ${p.speed}s ${p.delay}s ease-in-out forwards`,
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
          transition: 'opacity 1s ease',
        }}>
          {/* The original white logo — NO container */}
          <div style={{
            animation: phase >= 3 ? 'apex-logo-forge 2.5s ease-out forwards' : 'none',
            opacity: 0,
          }}>
            <img
              src={logoImage}
              alt="Apex Studio"
              style={{
                width: '50vmin',
                height: '50vmin',
                maxWidth: 450,
                maxHeight: 450,
                objectFit: 'contain',
                filter: phase >= 4
                  ? `drop-shadow(0 0 40px ${C.white20}) drop-shadow(0 0 80px ${C.blueSubtle})`
                  : `drop-shadow(0 0 25px ${C.white20}) brightness(1.4)`,
                transition: 'filter 1.2s ease',
                animation: phase >= 4 ? 'apex-logo-breathe 3s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* APEX text */}
          <div style={{
            overflow: 'hidden',
            marginTop: 36,
            animation: phase >= 3 ? 'apex-text-up 1.4s 0.8s ease-out both' : 'none',
          }}>
            <h1 style={{
              fontSize: 'clamp(50px, 12vw, 90px)',
              fontWeight: 100,
              letterSpacing: '0.55em',
              color: 'transparent',
              backgroundImage: `linear-gradient(135deg, ${C.white} 0%, rgba(255,255,255,0.85) 50%, ${C.blueBright} 100%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              textTransform: 'uppercase',
              fontFamily: "'Sora', sans-serif",
              lineHeight: 1,
              animation: phase >= 4 ? 'apex-shimmer 4s ease-in-out infinite' : 'none',
              backgroundSize: '200% 100%',
            }}>
              Apex
            </h1>
          </div>

          {/* STUDIOS */}
          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-up 1.2s 1.3s ease-out both' : 'none',
          }}>
            <p style={{
              fontSize: 'clamp(14px, 3vw, 22px)',
              fontWeight: 300,
              letterSpacing: '0.85em',
              color: C.whiteHalf,
              textTransform: 'uppercase',
              marginTop: 12,
              fontFamily: "'Sora', sans-serif",
            }}>
              Studios
            </p>
          </div>

          {/* ═══ PHASE 4: BRAND STAMP ═══ */}
          {phase >= 4 && (
            <>
              {/* Accent line — white to dark blue gradient */}
              <div style={{
                width: 120, height: 1,
                background: `linear-gradient(90deg, transparent, ${C.whiteHalf}, ${C.blueBright}, transparent)`,
                marginTop: 32,
                animation: 'apex-line 0.8s ease-out forwards',
              }} />

              {/* Tagline */}
              <p style={{
                fontSize: 'clamp(10px, 1.8vw, 15px)',
                fontWeight: 300,
                letterSpacing: '0.4em',
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                marginTop: 20,
                animation: 'apex-tagline 1s 0.3s ease-out both',
                fontFamily: "'Instrument Sans', sans-serif",
              }}>
                Where Stories Come Alive
              </p>

              {/* Shockwaves — the "thud" */}
              {[300, 240, 180].map((size, i) => (
                <div key={`wave-${i}`} style={{
                  position: 'fixed', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: size, height: size, borderRadius: '50%',
                  border: `${1.5 - i * 0.3}px solid ${i === 1 ? C.blueLight : C.white10}`,
                  animation: `apex-wave ${1.5 + i * 0.5}s ${i * 0.2}s ease-out forwards`,
                  zIndex: 5,
                }} />
              ))}

              {/* Deep glow thud */}
              <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90vmin', height: '90vmin', borderRadius: '50%',
                background: `radial-gradient(circle, ${C.blueSubtle} 0%, transparent 45%)`,
                animation: 'apex-thud 1.5s ease-out forwards',
                zIndex: 5,
              }} />
            </>
          )}
        </div>

        {/* ═══ PHASE 5: CINEMATIC EXIT — Warp + letterbox close ═══ */}
        {phase >= 5 && (
          <>
            {/* Warp streaks */}
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
                  background: w.isBlue
                    ? `linear-gradient(to bottom, ${C.blueBright}, transparent)`
                    : `linear-gradient(to bottom, ${C.whiteHalf}, transparent)`,
                  transformOrigin: 'center top',
                  transform: `rotate(${w.angle}deg)`,
                  animation: `apex-warp-streak ${0.5 + w.delay}s ${w.delay}s ease-in forwards`,
                  opacity: 0,
                }} />
              ))}
            </div>

            {/* Cinematic letterbox bars closing in */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              background: `linear-gradient(to bottom, ${C.bg}, ${C.blue})`,
              zIndex: 50,
              height: '0%',
              animation: 'apex-letterbox-close 1.2s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: `linear-gradient(to top, ${C.bg}, ${C.blue})`,
              zIndex: 50,
              height: '0%',
              animation: 'apex-letterbox-close 1.2s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }} />

            {/* Final dark blue vignette instead of white flash */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 45,
              background: `radial-gradient(ellipse at center, transparent 20%, ${C.blue} 70%, ${C.bg} 100%)`,
              animation: 'apex-vignette 1s 0.3s ease-in forwards',
              opacity: 0,
            }} />
          </>
        )}

        <style>{`
          @keyframes apex-twinkle {
            0%, 100% { opacity: 0; transform: scale(0.3); }
            50% { opacity: 0.6; transform: scale(1); }
          }
          @keyframes apex-ember {
            0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
            40% { transform: translate(-50%,-50%) scale(1.2); opacity: 0.5; }
            70% { transform: translate(-50%,-50%) scale(0.7); opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          }
          @keyframes apex-ambient {
            0%, 100% { opacity: 0.2; transform: translate(-50%,-50%) scale(0.85); }
            50% { opacity: 0.5; transform: translate(-50%,-50%) scale(1.15); }
          }
          @keyframes apex-ignite {
            0% { transform: translate(-50%,-50%) scale(1); }
            40% { transform: translate(-50%,-50%) scale(6); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(3); opacity: 0.6; }
          }
          @keyframes apex-nova {
            0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(14); opacity: 0; }
          }
          @keyframes apex-rotate {
            from { transform: translate(-50%,-50%) rotate(0deg); }
            to { transform: translate(-50%,-50%) rotate(360deg); }
          }
          @keyframes apex-ray-in {
            0% { opacity: 0; height: 0; }
            30% { opacity: 0.8; }
            100% { opacity: 0.25; height: 50%; }
          }
          @keyframes apex-bloom {
            0% { transform: translate(-50%,-50%) scale(0.05); opacity: 0; }
            30% { opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
          }
          @keyframes apex-swirl {
            0% { opacity: 0; transform: rotate(0deg) translateY(0); }
            15% { opacity: 0.9; }
            100% { opacity: 0; transform: rotate(280deg) translateY(-350px); }
          }
          @keyframes apex-logo-forge {
            0% { transform: scale(0.08); opacity: 0; filter: blur(30px) brightness(6); }
            20% { opacity: 0.3; filter: blur(15px) brightness(3); }
            50% { filter: blur(5px) brightness(1.8); }
            75% { filter: blur(1px) brightness(1.2); }
            100% { transform: scale(1); opacity: 1; filter: blur(0) brightness(1); }
          }
          @keyframes apex-logo-breathe {
            0%, 100% { filter: drop-shadow(0 0 40px rgba(255,255,255,0.2)) drop-shadow(0 0 80px rgba(26,39,68,0.3)); }
            50% { filter: drop-shadow(0 0 60px rgba(255,255,255,0.3)) drop-shadow(0 0 120px rgba(26,39,68,0.4)); }
          }
          @keyframes apex-text-up {
            0% { transform: translateY(130%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes apex-shimmer {
            0% { background-position: -100% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes apex-line {
            0% { width: 0; opacity: 0; }
            100% { width: 120px; opacity: 1; }
          }
          @keyframes apex-tagline {
            0% { opacity: 0; transform: translateY(14px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes apex-wave {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
            100% { transform: translate(-50%,-50%) scale(10); opacity: 0; }
          }
          @keyframes apex-thud {
            0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
            20% { opacity: 0.5; }
            100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; }
          }
          @keyframes apex-warp-streak {
            0% { opacity: 0; transform: rotate(var(--a,0deg)) scaleY(0.03); }
            30% { opacity: 0.8; }
            100% { opacity: 0; transform: rotate(var(--a,0deg)) scaleY(6); }
          }
          @keyframes apex-letterbox-close {
            0% { height: 0%; }
            100% { height: 52%; }
          }
          @keyframes apex-vignette {
            0% { opacity: 0; }
            100% { opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
