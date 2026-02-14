/**
 * CinematicTransition - World-class cinematic studio entrance
 * 
 * Features: triple concentric progress rings, radial light rays,
 * star field, shockwave pulse, morphing diamond core, ambient particles,
 * and cinematic letterbox exit.
 */

import { memo, forwardRef, useEffect, useRef, useState, useMemo } from 'react';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete }, ref) {
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

    // Generate stable random values for particles and stars
    const particles = useMemo(() => 
      Array.from({ length: 40 }, (_, i) => ({
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        size: 2 + Math.random() * 3,
        opacity: 0.2 + Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 1.5,
      })), []
    );

    const stars = useMemo(() =>
      Array.from({ length: 60 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2,
        duration: 1 + Math.random() * 2,
        delay: Math.random() * 2,
      })), []
    );

    const rays = useMemo(() =>
      Array.from({ length: 12 }, (_, i) => ({
        angle: (360 / 12) * i,
        width: 1.5 + Math.random(),
        delay: i * 0.08,
      })), []
    );

    useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
    }, []);

    useEffect(() => {
      if (!isActive) {
        hasNavigated.current = false;
        setProgress(0);
        setPhase('enter');
        return;
      }

      setPhase('enter');
      const duration = 3500;
      const start = Date.now();

      const tick = () => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - start;
        // Ease-in-out progress curve
        const linear = Math.min(elapsed / duration, 1);
        const eased = linear < 0.5
          ? 4 * linear * linear * linear
          : 1 - Math.pow(-2 * linear + 2, 3) / 2;
        const pct = eased * 100;
        setProgress(pct);
        if (pct > 30) setPhase('hold');
        if (linear < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          setPhase('exit');
          setTimeout(() => onComplete(), 500);
        }
      }, duration);

      return () => clearTimeout(timer);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    const r1 = 52, r2 = 42, r3 = 32;
    const c1 = 2 * Math.PI * r1;
    const c2 = 2 * Math.PI * r2;
    const c3 = 2 * Math.PI * r3;

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030108',
          overflow: 'hidden',
        }}
      >
        {/* Deep space background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.08) 0%, rgba(15,5,40,0.4) 40%, transparent 70%)',
          animation: 'ct-bg-breathe 3s ease-in-out infinite',
        }} />

        {/* Star field */}
        {stars.map((s, i) => (
          <div key={`star-${i}`} style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'white',
            animation: `ct-twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
            opacity: 0,
          }} />
        ))}

        {/* Radial light rays */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800, height: 800,
          animation: 'ct-rays-rotate 20s linear infinite',
          opacity: progress > 10 ? 0.4 : 0,
          transition: 'opacity 1s ease',
        }}>
          {rays.map((r, i) => (
            <div key={`ray-${i}`} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: `${r.width}px`,
              height: '400px',
              background: 'linear-gradient(to top, rgba(167,139,250,0.3), transparent)',
              transformOrigin: 'bottom center',
              transform: `translate(-50%, -100%) rotate(${r.angle}deg)`,
              animation: `ct-ray-pulse 2s ${r.delay}s ease-in-out infinite`,
            }} />
          ))}
        </div>

        {/* Primary radial glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 700, height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(139,92,246,0.15) 30%, rgba(88,28,135,0.05) 55%, transparent 70%)',
          animation: 'ct-glow-expand 2.5s ease-out forwards',
          filter: 'blur(20px)',
        }} />

        {/* Secondary warm glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,167,255,0.15) 0%, transparent 60%)',
          animation: 'ct-inner-glow 2s 0.5s ease-out forwards',
          opacity: 0,
        }} />

        {/* Shockwave ring */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120,
          borderRadius: '50%',
          border: '2px solid rgba(167,139,250,0.5)',
          animation: 'ct-shockwave 2s 0.8s ease-out forwards',
          opacity: 0,
        }} />

        {/* Second shockwave */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120,
          borderRadius: '50%',
          border: '1px solid rgba(196,167,255,0.3)',
          animation: 'ct-shockwave 2.5s 1.5s ease-out forwards',
          opacity: 0,
        }} />

        {/* Floating particles */}
        {particles.map((p, i) => (
          <div key={`p-${i}`} style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `rgba(167, 139, 250, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(139,92,246,0.3)`,
            animation: `ct-float ${p.duration}s ${p.delay}s ease-in-out infinite`,
            opacity: 0,
          }} />
        ))}

        {/* Central content */}
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
          animation: 'ct-content-enter 0.8s 0.2s ease-out both',
        }}>
          {/* Triple ring system */}
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <svg width="140" height="140" viewBox="0 0 120 120" style={{
              position: 'absolute', inset: 0,
              filter: 'drop-shadow(0 0 15px rgba(124,58,237,0.5))',
            }}>
              {/* Outer ring - slow, reverse */}
              <circle cx="60" cy="60" r={r1} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
              <circle
                cx="60" cy="60" r={r1} fill="none"
                stroke="url(#ring1grad)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={c1}
                strokeDashoffset={c1 * (1 - progress / 100)}
                style={{
                  transition: 'stroke-dashoffset 0.15s linear',
                  animation: 'ct-ring-spin-reverse 8s linear infinite',
                  transformOrigin: 'center',
                }}
              />

              {/* Middle ring - main progress */}
              <circle cx="60" cy="60" r={r2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle
                cx="60" cy="60" r={r2} fill="none"
                stroke="url(#ring2grad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={c2}
                strokeDashoffset={c2 * (1 - progress / 100)}
                style={{
                  transition: 'stroke-dashoffset 0.15s linear',
                  filter: 'drop-shadow(0 0 6px rgba(139,92,246,0.8))',
                }}
              />

              {/* Inner ring - fast */}
              <circle cx="60" cy="60" r={r3} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <circle
                cx="60" cy="60" r={r3} fill="none"
                stroke="url(#ring3grad)"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray={c3}
                strokeDashoffset={c3 * (1 - Math.min(progress * 1.3, 100) / 100)}
                style={{
                  transition: 'stroke-dashoffset 0.15s linear',
                  animation: 'ct-ring-spin 5s linear infinite',
                  transformOrigin: 'center',
                }}
              />

              {/* Orbiting dot */}
              <circle
                cx="60"
                cy={60 - r2}
                r="3"
                fill="white"
                style={{
                  filter: 'drop-shadow(0 0 6px white)',
                  animation: 'ct-ring-spin 3s linear infinite',
                  transformOrigin: '60px 60px',
                }}
              />

              <defs>
                <linearGradient id="ring1grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="ring2grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="50%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#5b21b6" />
                </linearGradient>
                <linearGradient id="ring3grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e9d5ff" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.3" />
                </linearGradient>
              </defs>
            </svg>

            {/* Core diamond */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 18, height: 18,
                background: 'linear-gradient(135deg, #e9d5ff, #7c3aed)',
                borderRadius: 4,
                animation: 'ct-diamond-morph 2s ease-in-out infinite',
                boxShadow: '0 0 20px rgba(139,92,246,0.6), 0 0 40px rgba(124,58,237,0.3)',
              }} />
            </div>
          </div>

          {/* Text group */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              textShadow: '0 0 20px rgba(139,92,246,0.5)',
            }}>
              Entering Studio
            </p>
            <p style={{
              fontSize: 28,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 8,
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 10px rgba(139,92,246,0.3)',
              animation: 'ct-number-glow 1.5s ease-in-out infinite',
            }}>
              {Math.floor(progress)}%
            </p>
          </div>

          {/* Loading bar */}
          <div style={{
            width: 200, height: 2,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 1,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd)',
              borderRadius: 1,
              transition: 'width 0.15s linear',
              boxShadow: '0 0 10px rgba(139,92,246,0.5)',
            }} />
          </div>
        </div>

        {/* Letterbox exit bars */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, background: '#030108', zIndex: 30,
          height: phase === 'exit' ? '50%' : '0%',
          transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, background: '#030108', zIndex: 30,
          height: phase === 'exit' ? '50%' : '0%',
          transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />

        <style>{`
          @keyframes ct-bg-breathe {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes ct-twinkle {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 0.8; transform: scale(1); }
          }
          @keyframes ct-glow-expand {
            0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.85; }
          }
          @keyframes ct-inner-glow {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes ct-shockwave {
            0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(6); }
          }
          @keyframes ct-float {
            0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
            25% { opacity: 1; transform: translateY(-20px) scale(1.2); }
            75% { opacity: 0.6; transform: translateY(-50px) scale(0.8); }
          }
          @keyframes ct-content-enter {
            from { opacity: 0; transform: translateY(20px) scale(0.9); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes ct-ring-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes ct-ring-spin-reverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes ct-diamond-morph {
            0%, 100% { transform: rotate(0deg) scale(1); border-radius: 4px; }
            25% { transform: rotate(45deg) scale(1.2); border-radius: 50%; }
            50% { transform: rotate(90deg) scale(0.9); border-radius: 4px; }
            75% { transform: rotate(135deg) scale(1.1); border-radius: 50%; }
          }
          @keyframes ct-number-glow {
            0%, 100% { text-shadow: 0 0 10px rgba(139,92,246,0.3); }
            50% { text-shadow: 0 0 25px rgba(139,92,246,0.6); }
          }
          @keyframes ct-rays-rotate {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes ct-ray-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
