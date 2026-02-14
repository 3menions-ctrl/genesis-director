/**
 * CinematicTransition - The APEX STUDIOS Signature Brand Animation
 * 
 * A 5-second cinematic intro sequence inspired by Netflix/Disney brand animations.
 * Phases: Void → Supernova → Forge → Brand Stamp → Portal Entry
 */

import { memo, forwardRef, useEffect, useRef, useState, useMemo, useCallback } from 'react';

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
    const [phase, setPhase] = useState(0); // 0-5

    const particles = useMemo(() =>
      Array.from({ length: 50 }, () => ({
        angle: Math.random() * 360,
        dist: 30 + Math.random() * 70,
        size: 1.5 + Math.random() * 2.5,
        speed: 0.5 + Math.random() * 1.5,
        delay: Math.random() * 0.8,
      })), []
    );

    const warpLines = useMemo(() =>
      Array.from({ length: 24 }, (_, i) => ({
        angle: (360 / 24) * i + Math.random() * 8,
        length: 60 + Math.random() * 40,
        width: 1 + Math.random() * 1.5,
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

        // Phase transitions
        if (t > 0.08 && t <= 0.30) setPhase(2);      // Supernova
        else if (t > 0.30 && t <= 0.55) setPhase(3);  // Forge
        else if (t > 0.55 && t <= 0.82) setPhase(4);  // Brand Stamp
        else if (t > 0.82) setPhase(5);                // Portal Entry

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
          background: '#020009', overflow: 'hidden',
        }}
      >
        {/* ======= PHASE 1: VOID - Single igniting point ======= */}
        <div
          className="apex-ignition"
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#a78bfa',
            boxShadow: '0 0 30px 10px rgba(139,92,246,0.8), 0 0 60px 20px rgba(124,58,237,0.4)',
            opacity: phase >= 1 ? 1 : 0,
            animation: phase >= 1 ? 'apex-ignite 0.4s ease-out forwards' : 'none',
          }}
        />

        {/* ======= PHASE 2: SUPERNOVA - Light explosion ======= */}
        {phase >= 2 && (
          <>
            {/* Expanding nova ring */}
            <div
              className="apex-nova"
              style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 100, height: 100,
                borderRadius: '50%',
                border: '2px solid rgba(196,167,255,0.6)',
                animation: 'apex-nova-expand 1.2s ease-out forwards',
              }}
            />
            {/* Second nova ring */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 80, height: 80,
              borderRadius: '50%',
              border: '1px solid rgba(139,92,246,0.4)',
              animation: 'apex-nova-expand 1.5s 0.15s ease-out forwards',
            }} />

            {/* Radial light burst */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 800, height: 800,
              animation: 'apex-burst-rotate 15s linear infinite',
            }}>
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={`burst-${i}`} style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  width: 1.5,
                  height: 350,
                  background: `linear-gradient(to top, rgba(167,139,250,${0.2 + (i % 3) * 0.1}), transparent 70%)`,
                  transformOrigin: 'bottom center',
                  transform: `translate(-50%, -100%) rotate(${(360 / 16) * i}deg)`,
                  animation: `apex-ray-in 0.8s ${i * 0.03}s ease-out both`,
                }} />
              ))}
            </div>

            {/* Massive glow bloom */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 600, height: 600,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(124,58,237,0.15) 35%, transparent 65%)',
              filter: 'blur(30px)',
              animation: 'apex-bloom 1s ease-out forwards',
            }} />

            {/* Swirling particles */}
            {particles.map((p, i) => (
              <div key={`sp-${i}`} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: 'rgba(196,167,255,0.8)',
                boxShadow: '0 0 4px rgba(167,139,250,0.6)',
                animation: `apex-swirl ${p.speed + 1}s ${p.delay}s ease-in-out forwards`,
                transformOrigin: 'center',
                transform: `rotate(${p.angle}deg) translateY(-${p.dist}px)`,
                opacity: 0,
              }} />
            ))}
          </>
        )}

        {/* ======= PHASE 3: FORGE - Logo materializes from energy ======= */}
        <div style={{
          position: 'relative', zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: phase >= 3 ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}>
          {/* Geometric Pyramid Crown */}
          <div style={{
            marginBottom: 20,
            opacity: phase >= 3 ? 1 : 0,
            animation: phase >= 3 ? 'apex-forge-in 1s ease-out forwards' : 'none',
          }}>
            <svg width="80" height="70" viewBox="0 0 80 70" fill="none">
              {/* Pyramid shape */}
              <path
                d="M40 2 L75 62 L5 62 Z"
                stroke="url(#pyramidGrad)"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: 200,
                  strokeDashoffset: phase >= 3 ? 0 : 200,
                  transition: 'stroke-dashoffset 1.2s ease-out',
                  filter: 'drop-shadow(0 0 12px rgba(139,92,246,0.7))',
                }}
              />
              {/* Inner pyramid lines */}
              <path
                d="M40 2 L40 42 M22 42 L58 42"
                stroke="url(#pyramidGrad2)"
                strokeWidth="1.2"
                fill="none"
                style={{
                  strokeDasharray: 80,
                  strokeDashoffset: phase >= 3 ? 0 : 80,
                  transition: 'stroke-dashoffset 1.4s 0.3s ease-out',
                  filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.5))',
                }}
              />
              {/* Crown jewel at apex */}
              <circle
                cx="40" cy="8" r="3"
                fill={phase >= 4 ? '#e9d5ff' : 'transparent'}
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(233,213,255,0.8))',
                  transition: 'fill 0.5s ease',
                }}
              />
              <defs>
                <linearGradient id="pyramidGrad" x1="5" y1="62" x2="75" y2="2">
                  <stop offset="0%" stopColor="#5b21b6" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#e9d5ff" />
                </linearGradient>
                <linearGradient id="pyramidGrad2" x1="22" y1="42" x2="58" y2="2">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.7" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* APEX STUDIOS text */}
          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-reveal 1s 0.4s ease-out both' : 'none',
          }}>
            <h1 style={{
              fontSize: 42,
              fontWeight: 200,
              letterSpacing: '0.45em',
              color: 'transparent',
              backgroundImage: 'linear-gradient(135deg, #e9d5ff 0%, #ffffff 40%, #a78bfa 80%, #7c3aed 100%)',
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

          <div style={{
            overflow: 'hidden',
            animation: phase >= 3 ? 'apex-text-reveal 0.8s 0.7s ease-out both' : 'none',
          }}>
            <p style={{
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: '0.6em',
              color: 'rgba(167,139,250,0.7)',
              textTransform: 'uppercase',
              marginTop: 6,
              fontFamily: "'Sora', sans-serif",
            }}>
              Studios
            </p>
          </div>

          {/* ======= PHASE 4: BRAND STAMP - Shockwave "thud" ======= */}
          {phase >= 4 && (
            <>
              {/* Horizontal rule accent */}
              <div style={{
                width: 60, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)',
                marginTop: 20,
                animation: 'apex-line-expand 0.6s ease-out forwards',
              }} />

              {/* Tagline */}
              <p style={{
                fontSize: 11,
                fontWeight: 300,
                letterSpacing: '0.3em',
                color: 'rgba(196,167,255,0.5)',
                textTransform: 'uppercase',
                marginTop: 14,
                animation: 'apex-tagline-in 0.8s 0.2s ease-out both',
                fontFamily: "'Instrument Sans', sans-serif",
              }}>
                Where Stories Come Alive
              </p>

              {/* Stamp shockwave */}
              <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 150, height: 150,
                borderRadius: '50%',
                border: '1.5px solid rgba(167,139,250,0.4)',
                animation: 'apex-stamp-wave 1s ease-out forwards',
                zIndex: 5,
              }} />

              {/* Logo glow pulse — the "ta-dum" */}
              <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 300, height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 60%)',
                animation: 'apex-thud-glow 0.8s ease-out forwards',
                zIndex: 5,
              }} />
            </>
          )}
        </div>

        {/* ======= PHASE 5: PORTAL ENTRY - Warp speed ======= */}
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
                  background: `linear-gradient(to bottom, rgba(196,167,255,0.6), transparent)`,
                  transformOrigin: 'center top',
                  transform: `rotate(${w.angle}deg)`,
                  animation: `apex-warp ${0.6 + w.delay}s ${w.delay}s ease-in forwards`,
                  opacity: 0,
                }} />
              ))}
            </div>

            {/* White flash */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'white',
              animation: 'apex-flash 0.6s 0.4s ease-out forwards',
              opacity: 0,
            }} />
          </>
        )}

        <style>{`
          @keyframes apex-ignite {
            0% { transform: translate(-50%,-50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%,-50%) scale(3); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0.9; }
          }
          @keyframes apex-nova-expand {
            0% { transform: translate(-50%,-50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(8); opacity: 0; }
          }
          @keyframes apex-burst-rotate {
            from { transform: translate(-50%,-50%) rotate(0deg); }
            to { transform: translate(-50%,-50%) rotate(360deg); }
          }
          @keyframes apex-ray-in {
            0% { opacity: 0; height: 0; }
            50% { opacity: 1; }
            100% { opacity: 0.4; height: 350px; }
          }
          @keyframes apex-bloom {
            0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translate(-50%,-50%) scale(1); opacity: 0.7; }
          }
          @keyframes apex-swirl {
            0% { opacity: 0; transform: rotate(var(--angle, 0deg)) translateY(0); }
            30% { opacity: 1; }
            100% { opacity: 0; transform: rotate(calc(var(--angle, 0deg) + 180deg)) translateY(-200px); }
          }
          @keyframes apex-forge-in {
            0% { transform: scale(0.5) translateY(20px); opacity: 0; filter: blur(10px) brightness(3); }
            60% { filter: blur(0) brightness(1.5); }
            100% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0) brightness(1); }
          }
          @keyframes apex-text-reveal {
            0% { transform: translateY(100%); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes apex-text-shimmer {
            0% { background-position: -100% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes apex-line-expand {
            0% { width: 0; opacity: 0; }
            100% { width: 60px; opacity: 1; }
          }
          @keyframes apex-tagline-in {
            0% { opacity: 0; transform: translateY(8px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes apex-stamp-wave {
            0% { transform: translate(-50%,-50%) scale(1); opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(5); opacity: 0; }
          }
          @keyframes apex-thud-glow {
            0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
            30% { opacity: 0.8; }
            100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
          }
          @keyframes apex-warp {
            0% { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleY(0.1); }
            40% { opacity: 0.8; }
            100% { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleY(3); }
          }
          @keyframes apex-flash {
            0% { opacity: 0; }
            40% { opacity: 0.9; }
            100% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
