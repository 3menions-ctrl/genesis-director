/**
 * CinematicTransition - Premium cinematic entrance animation
 * 
 * A dramatic full-screen transition with violet glow, progress ring,
 * floating particles, and letterbox reveal.
 */

import { memo, forwardRef, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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

      console.log('[CinematicTransition] Animation STARTED');
      setPhase('enter');

      const duration = 3000;
      const start = Date.now();
      const tick = () => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - start;
        const pct = Math.min((elapsed / duration) * 100, 100);
        setProgress(pct);
        if (pct > 40) setPhase('hold');
        if (pct < 100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          console.log('[CinematicTransition] Animation COMPLETE, navigating...');
          setPhase('exit');
          setTimeout(() => onComplete(), 400);
        }
      }, duration);

      return () => clearTimeout(timer);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    const circumference = 2 * Math.PI * 34;

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
          background: '#000',
          overflow: 'hidden',
        }}
      >
        {/* Radial violet glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, rgba(124,58,237,0.1) 40%, transparent 70%)',
            animation: 'cinematic-glow 2s ease-out forwards',
          }}
        />

        {/* Floating particles */}
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: `rgba(167, 139, 250, ${0.3 + Math.random() * 0.4})`,
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animation: `cinematic-particle ${1.5 + Math.random() * 1.5}s ${0.2 + Math.random()}s ease-out forwards`,
              opacity: 0,
            }}
          />
        ))}

        {/* Central content */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, animation: 'cinematic-fade-in 0.5s 0.15s ease-out both' }}>
          {/* Progress ring */}
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <svg width="96" height="96" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress / 100)}
                style={{ filter: 'drop-shadow(0 0 8px rgba(124,58,237,0.6))', transition: 'stroke-dashoffset 0.1s linear' }}
              />
            </svg>
            {/* Spinning center */}
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                background: 'rgba(255,255,255,0.85)',
                animation: 'cinematic-spin 2s linear infinite',
                boxShadow: '0 0 12px rgba(255,255,255,0.3)',
              }} />
            </div>
          </div>

          {/* Text */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              Entering Studio
            </p>
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {Math.floor(progress)}%
            </p>
          </div>
        </div>

        {/* Letterbox bars for exit */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, background: '#000', zIndex: 30,
          height: phase === 'exit' ? '50%' : '0%',
          transition: 'height 0.4s ease-in',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, background: '#000', zIndex: 30,
          height: phase === 'exit' ? '50%' : '0%',
          transition: 'height 0.4s ease-in',
        }} />

        {/* CSS animations */}
        <style>{`
          @keyframes cinematic-glow {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
          }
          @keyframes cinematic-particle {
            0% { opacity: 0; transform: scale(0) translateY(0); }
            50% { opacity: 1; transform: scale(1.5) translateY(-30px); }
            100% { opacity: 0; transform: scale(0) translateY(-80px); }
          }
          @keyframes cinematic-fade-in {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes cinematic-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
