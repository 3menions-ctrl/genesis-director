/**
 * CinematicTransition - Premium cinematic entrance animation
 * 
 * Features a dramatic letterbox reveal with particle-like dots,
 * a glowing progress ring, and text fade — all CSS/Framer Motion only
 * (no Three.js or heavy 3D libraries).
 */

import { memo, forwardRef, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ isActive, onComplete, className }, ref) {
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

      // Phase 1: Enter (0-500ms)
      setPhase('enter');

      // Animate progress
      const start = Date.now();
      const duration = 1800;
      const tick = () => {
        if (!isMountedRef.current) return;
        const elapsed = Date.now() - start;
        const pct = Math.min((elapsed / duration) * 100, 100);
        setProgress(pct);
        
        if (pct > 40) setPhase('hold');
        
        if (pct < 100) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);

      // Navigate
      const timer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          setPhase('exit');
          setTimeout(() => onComplete(), 200);
        }
      }, 1800);

      return () => clearTimeout(timer);
    }, [isActive, onComplete]);

    if (!isActive) return null;

    return (
      <motion.div
        ref={ref}
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Background */}
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* Subtle radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.05) 40%, transparent 70%)',
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.2, 1], opacity: [0, 0.8, 0.6] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>

        {/* Floating particles (CSS only) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/20"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0, 1, 0],
                y: [0, -40 - Math.random() * 60],
              }}
              transition={{
                duration: 1.5 + Math.random(),
                delay: 0.2 + Math.random() * 0.8,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>

        {/* Central content */}
        <div className="relative flex flex-col items-center gap-8">
          {/* Circular progress ring */}
          <motion.div
            className="relative w-20 h-20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              {/* Track */}
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
              {/* Progress */}
              <motion.circle
                cx="40" cy="40" r="34" fill="none"
                stroke="url(#progress-gradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.5))' }}
              />
              <defs>
                <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-3 h-3 rounded-sm bg-white/80"
                animate={{ rotate: [0, 90, 180, 270, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <p className="text-sm font-medium text-white/70 tracking-[0.15em] uppercase">
              Entering Studio
            </p>
            <motion.p
              className="text-xs text-white/25 mt-2 tabular-nums"
              key={Math.floor(progress)}
            >
              {Math.floor(progress)}%
            </motion.p>
          </motion.div>
        </div>

        {/* Letterbox bars */}
        <motion.div
          className="absolute top-0 left-0 right-0 bg-black"
          initial={{ height: '0%' }}
          animate={{ height: phase === 'exit' ? '50%' : '0%' }}
          transition={{ duration: 0.3, ease: 'easeIn' }}
        />
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-black"
          initial={{ height: '0%' }}
          animate={{ height: phase === 'exit' ? '50%' : '0%' }}
          transition={{ duration: 0.3, ease: 'easeIn' }}
        />
      </motion.div>
    );
  }
));

CinematicTransition.displayName = 'CinematicTransition';
export default CinematicTransition;
