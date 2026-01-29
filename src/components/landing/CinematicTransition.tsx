import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

/**
 * Netflix/Disney-style cinematic reveal transition
 * Features: Epic logo reveal, particle explosion, wipe transition, audio-visual synchronization feel
 */
export default function CinematicTransition({ 
  isActive, 
  onComplete,
  className 
}: CinematicTransitionProps) {
  const [phase, setPhase] = useState<'idle' | 'logo' | 'explode' | 'wipe' | 'complete'>('idle');

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    // Phase 1: Logo reveal (0-1.5s)
    setPhase('logo');
    
    const explodeTimer = setTimeout(() => {
      setPhase('explode');
    }, 1500);

    // Phase 2: Particle explosion (1.5-2.5s)
    const wipeTimer = setTimeout(() => {
      setPhase('wipe');
    }, 2500);

    // Phase 3: Wipe transition and complete (2.5-3.5s)
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(explodeTimer);
      clearTimeout(wipeTimer);
      clearTimeout(completeTimer);
    };
  }, [isActive, onComplete]);

  // Generate particle positions
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    angle: (i * 6) + Math.random() * 10,
    distance: 150 + Math.random() * 400,
    size: 2 + Math.random() * 6,
    delay: Math.random() * 0.3,
    duration: 0.8 + Math.random() * 0.4,
  }));

  // Starburst rays
  const rays = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: i * 30,
    delay: i * 0.05,
  }));

  return (
    <AnimatePresence>
      {isActive && phase !== 'complete' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center overflow-hidden",
            className
          )}
        >
          {/* Deep black background with subtle gradient */}
          <motion.div 
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Ambient glow backdrop */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'logo' || phase === 'explode' ? 1 : 0,
            }}
            transition={{ duration: 0.8 }}
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 60%)',
            }}
          />

          {/* Cinematic letterbox bars */}
          <motion.div
            className="absolute top-0 left-0 right-0 bg-black z-50"
            initial={{ height: 0 }}
            animate={{ 
              height: phase === 'wipe' ? '100%' : '8%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 0.8 : 0.6,
              ease: [0.65, 0, 0.35, 1],
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-black z-50"
            initial={{ height: 0 }}
            animate={{ 
              height: phase === 'wipe' ? '100%' : '8%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 0.8 : 0.6,
              ease: [0.65, 0, 0.35, 1],
            }}
          />

          {/* Starburst rays */}
          {phase !== 'wipe' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {rays.map((ray) => (
                <motion.div
                  key={ray.id}
                  className="absolute w-[2px] origin-bottom"
                  style={{
                    height: '150vh',
                    transform: `rotate(${ray.angle}deg)`,
                    background: 'linear-gradient(to top, transparent 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.15) 70%, transparent 100%)',
                  }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ 
                    scaleY: phase === 'explode' ? 1 : 0.3,
                    opacity: phase === 'explode' ? [0, 0.8, 0] : 0.3,
                  }}
                  transition={{ 
                    duration: 0.8,
                    delay: ray.delay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              ))}
            </div>
          )}

          {/* Central logo reveal */}
          <motion.div
            className="relative z-20 flex flex-col items-center"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: phase === 'explode' ? 1.2 : 1,
              opacity: phase === 'wipe' ? 0 : 1,
            }}
            transition={{ 
              duration: 1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Logo glow */}
            <motion.div
              className="absolute inset-0 blur-[60px] pointer-events-none"
              animate={{
                opacity: phase === 'explode' ? [0.5, 1, 0] : 0.3,
                scale: phase === 'explode' ? [1, 2, 3] : 1,
              }}
              transition={{ duration: 1 }}
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%)',
              }}
            />

            {/* APEX logo */}
            <motion.div
              className="relative"
              style={{ perspective: '1000px' }}
            >
              <motion.div
                initial={{ rotateX: -90, y: 100 }}
                animate={{ 
                  rotateX: 0, 
                  y: 0,
                  scale: phase === 'explode' ? [1, 1.1, 1] : 1,
                }}
                transition={{ 
                  duration: 1,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <h1 className="text-7xl md:text-9xl font-black tracking-[-0.04em] text-white relative">
                  {'APEX'.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      className="inline-block"
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        textShadow: phase === 'explode' 
                          ? '0 0 60px rgba(255,255,255,0.8), 0 0 120px rgba(255,255,255,0.4)' 
                          : '0 0 30px rgba(255,255,255,0.3)',
                      }}
                      transition={{
                        duration: 0.6,
                        delay: 0.2 + i * 0.1,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </h1>
              </motion.div>
            </motion.div>

            {/* Tagline */}
            <motion.p
              className="mt-4 text-white/60 text-lg md:text-xl tracking-[0.3em] uppercase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: phase === 'logo' || phase === 'explode' ? 1 : 0,
                y: 0,
              }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              Discover Gallery
            </motion.p>
          </motion.div>

          {/* Particle explosion */}
          {phase === 'explode' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              {particles.map((particle) => {
                const rad = (particle.angle * Math.PI) / 180;
                const x = Math.cos(rad) * particle.distance;
                const y = Math.sin(rad) * particle.distance;
                
                return (
                  <motion.div
                    key={particle.id}
                    className="absolute rounded-full bg-white"
                    style={{
                      width: particle.size,
                      height: particle.size,
                      boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.4)',
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                    animate={{ 
                      x, 
                      y, 
                      opacity: [1, 1, 0],
                      scale: [0, 1, 0.5],
                    }}
                    transition={{
                      duration: particle.duration,
                      delay: particle.delay,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Ring expansion */}
          {phase === 'explode' && (
            <>
              <motion.div
                className="absolute w-4 h-4 rounded-full border-2 border-white/60 z-25"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 80, opacity: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="absolute w-4 h-4 rounded-full border border-white/40 z-25"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 100, opacity: 0 }}
                transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
              <motion.div
                className="absolute w-4 h-4 rounded-full border border-white/20 z-25"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 120, opacity: 0 }}
                transition={{ duration: 1.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              />
            </>
          )}

          {/* Final flash */}
          <motion.div
            className="absolute inset-0 bg-white z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'wipe' ? [0, 0.8, 0] : 0,
            }}
            transition={{ duration: 0.4 }}
          />

          {/* Noise texture overlay */}
          <motion.div 
            className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay z-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
