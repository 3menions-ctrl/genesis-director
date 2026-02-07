import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, memo, forwardRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CinematicTransitionProps {
  isActive: boolean;
  onComplete: () => void;
  className?: string;
}

/**
 * Netflix/Disney-style cinematic reveal transition
 * Features: Epic logo reveal, particle explosion, wipe transition, audio-visual synchronization feel
 * 
 * EXTENDED TIMINGS for breathtaking premium experience:
 * - Buildup: 0-2.5s (tension building)
 * - Logo reveal: 2.5-7s (grand entrance)
 * - Explode: 7-10s (epic particle burst)
 * - Wipe: 10-13s (cinematic transition)
 * - Navigate: 12s (during wipe, before overlay fades)
 */
const CinematicTransition = memo(forwardRef<HTMLDivElement, CinematicTransitionProps>(
  function CinematicTransition({ 
    isActive, 
    onComplete,
    className 
  }, ref) {
    const [phase, setPhase] = useState<'idle' | 'buildup' | 'logo' | 'explode' | 'wipe'>('idle');
    const hasNavigated = useRef(false);
    const isMountedRef = useRef(true);
    const timersRef = useRef<NodeJS.Timeout[]>([]);

    // Safe setState that checks mount status
    const safeSetPhase = useCallback((newPhase: typeof phase) => {
      if (isMountedRef.current) {
        setPhase(newPhase);
      }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        // Clear all pending timers
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    }, []);

    useEffect(() => {
      if (!isActive) {
        safeSetPhase('idle');
        hasNavigated.current = false;
        // Clear any existing timers when deactivated
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        return;
      }

      // Clear previous timers
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      // Phase 0: Buildup tension (0-2.5s) - Extended for more anticipation
      safeSetPhase('buildup');

      // Phase 1: Logo reveal (2.5-7s) - Extended for grander entrance
      const logoTimer = setTimeout(() => {
        safeSetPhase('logo');
      }, 2500);
      timersRef.current.push(logoTimer);
      
      // Phase 2: Particle explosion (7-10s) - Extended for epic effect
      const explodeTimer = setTimeout(() => {
        safeSetPhase('explode');
      }, 7000);
      timersRef.current.push(explodeTimer);

      // Phase 3: Wipe transition (10-13s)
      const wipeTimer = setTimeout(() => {
        safeSetPhase('wipe');
      }, 10000);
      timersRef.current.push(wipeTimer);

      // Navigate DURING wipe (at 12s) - while overlay is still visible
      // This prevents the flicker as navigation happens before overlay fades
      const navigateTimer = setTimeout(() => {
        if (!hasNavigated.current && isMountedRef.current) {
          hasNavigated.current = true;
          onComplete();
        }
      }, 12000);
      timersRef.current.push(navigateTimer);

      return () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      };
    }, [isActive, onComplete, safeSetPhase]);

  // Generate particle positions - more particles for epic effect
  const particles = Array.from({ length: 150 }, (_, i) => ({
    id: i,
    angle: (i * 2.4) + Math.random() * 8,
    distance: 200 + Math.random() * 800,
    size: 2 + Math.random() * 10,
    delay: Math.random() * 0.6,
    duration: 1.8 + Math.random() * 0.8,
    opacity: 0.6 + Math.random() * 0.4,
  }));

  // Starburst rays - more rays for premium feel
  const rays = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    angle: i * 11.25,
    delay: i * 0.025,
    width: i % 4 === 0 ? 4 : i % 2 === 0 ? 2 : 1,
  }));

  // Floating orbs for ambient effect
  const orbs = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.cos((i * Math.PI * 2) / 12) * 350,
    y: Math.sin((i * Math.PI * 2) / 12) * 250,
    size: 80 + Math.random() * 120,
    delay: i * 0.12,
  }));

  // Concentric pulse rings
  const pulseRings = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    delay: i * 0.4,
    size: 200 + i * 100,
  }));

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center overflow-hidden",
            className
          )}
        >
          {/* Deep black background with premium gradient */}
          <motion.div 
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              background: 'radial-gradient(ellipse at center, #080810 0%, #000000 70%)',
            }}
          />

          {/* Premium blue/silver ambient pulse glow */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'buildup' ? [0, 0.3, 0.1, 0.4, 0.2, 0.5] : 
                       phase === 'logo' ? [0.5, 0.7, 0.5, 0.8] :
                       phase === 'explode' ? [0.8, 1, 0.6, 0] : 0,
            }}
            transition={{ 
              duration: phase === 'buildup' ? 2 : phase === 'logo' ? 4 : 2,
              ease: "easeInOut",
              repeat: phase === 'logo' ? Infinity : 0,
              repeatType: "reverse",
            }}
            style={{
              background: 'radial-gradient(ellipse at center, rgba(100, 150, 255, 0.25) 0%, rgba(180, 200, 255, 0.12) 35%, transparent 65%)',
            }}
          />

          {/* Secondary silver glow layer */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'logo' || phase === 'explode' ? 0.35 : 0,
            }}
            transition={{ duration: 2 }}
            style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(200, 220, 255, 0.18) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(140, 180, 255, 0.15) 0%, transparent 50%)',
            }}
          />

          {/* Concentric pulse rings during buildup */}
          {phase === 'buildup' && pulseRings.map((ring) => (
            <motion.div
              key={ring.id}
              className="absolute rounded-full border pointer-events-none"
              style={{
                width: ring.size,
                height: ring.size,
                borderColor: `rgba(140, 180, 255, ${0.15 - ring.id * 0.02})`,
                borderWidth: 1,
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ 
                scale: [0.5, 1.5, 2],
                opacity: [0, 0.4, 0],
              }}
              transition={{
                duration: 2.5,
                delay: ring.delay,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Floating premium blue/silver orbs */}
          {(phase === 'buildup' || phase === 'logo') && orbs.map((orb) => (
            <motion.div
              key={orb.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: orb.size,
                height: orb.size,
                background: orb.id % 3 === 0 
                  ? 'radial-gradient(circle, rgba(100, 150, 255, 0.18) 0%, rgba(140, 180, 255, 0.06) 50%, transparent 70%)'
                  : orb.id % 3 === 1
                  ? 'radial-gradient(circle, rgba(180, 200, 255, 0.15) 0%, rgba(220, 230, 255, 0.05) 50%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(120, 160, 255, 0.12) 0%, rgba(160, 190, 255, 0.04) 50%, transparent 70%)',
                filter: 'blur(30px)',
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ 
                x: orb.x,
                y: orb.y,
                opacity: [0, 0.8, 0.5, 0.7],
                scale: [0, 1.4, 1, 1.2],
              }}
              transition={{
                duration: 3.5,
                delay: orb.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}

          {/* Cinematic letterbox bars */}
          <motion.div
            className="absolute top-0 left-0 right-0 bg-black z-50"
            initial={{ height: 0 }}
            animate={{ 
              height: phase === 'wipe' ? '100%' : '12%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 2 : 1.5,
              ease: [0.65, 0, 0.35, 1],
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-black z-50"
            initial={{ height: 0 }}
            animate={{ 
              height: phase === 'wipe' ? '100%' : '12%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 2 : 1.5,
              ease: [0.65, 0, 0.35, 1],
            }}
          />

          {/* Premium silver/blue starburst rays */}
          {(phase === 'logo' || phase === 'explode') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {rays.map((ray) => (
                <motion.div
                  key={ray.id}
                  className="absolute origin-center"
                  style={{
                    width: ray.width,
                    height: '250vh',
                    transform: `rotate(${ray.angle}deg)`,
                    background: ray.id % 4 === 0 
                      ? `linear-gradient(to top, 
                          transparent 0%, 
                          rgba(100, 150, 255, 0.1) 15%,
                          rgba(140, 180, 255, ${ray.width >= 3 ? 0.45 : 0.22}) 42%, 
                          rgba(180, 210, 255, ${ray.width >= 3 ? 0.7 : 0.4}) 50%, 
                          rgba(140, 180, 255, ${ray.width >= 3 ? 0.45 : 0.22}) 58%, 
                          rgba(100, 150, 255, 0.1) 85%,
                          transparent 100%)`
                      : `linear-gradient(to top, 
                          transparent 0%, 
                          rgba(200, 215, 255, 0.07) 15%,
                          rgba(220, 230, 255, ${ray.width >= 2 ? 0.35 : 0.18}) 42%, 
                          rgba(245, 248, 255, ${ray.width >= 2 ? 0.55 : 0.32}) 50%, 
                          rgba(220, 230, 255, ${ray.width >= 2 ? 0.35 : 0.18}) 58%, 
                          rgba(200, 215, 255, 0.07) 85%,
                          transparent 100%)`,
                  }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ 
                    scaleY: phase === 'explode' ? [0.6, 1.8, 0] : [0, 0.6],
                    opacity: phase === 'explode' ? [0.9, 1, 0] : [0, 0.8],
                  }}
                  transition={{ 
                    duration: phase === 'explode' ? 1.8 : 2,
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
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ 
              scale: phase === 'buildup' ? 0.4 :
                     phase === 'logo' ? 1 :
                     phase === 'explode' ? 1.4 : 
                     phase === 'wipe' ? 1.6 : 1,
              opacity: phase === 'wipe' ? 0 : 1,
            }}
            transition={{ 
              duration: 2,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Multi-layer premium blue/silver logo glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ transform: 'scale(4)' }}
              animate={{
                opacity: phase === 'explode' ? [0.5, 1, 0] : 
                         phase === 'logo' ? [0, 0.5, 0.3, 0.6] : 0.2,
              }}
              transition={{ duration: 2 }}
            >
              <div 
                className="w-full h-full blur-[120px]"
                style={{
                  background: 'radial-gradient(circle, rgba(140, 180, 255, 0.6) 0%, rgba(100, 150, 255, 0.35) 35%, transparent 65%)',
                }}
              />
            </motion.div>

            {/* Secondary silver glow layer */}
            <motion.div
              className="absolute inset-0 blur-[50px] pointer-events-none"
              animate={{
                opacity: phase === 'explode' ? [0.7, 1, 0] : 0.6,
                scale: phase === 'explode' ? [1, 3, 5] : 1,
              }}
              transition={{ duration: 1.8 }}
              style={{
                background: 'radial-gradient(circle, rgba(200, 220, 255, 0.75) 0%, rgba(160, 190, 255, 0.45) 40%, transparent 65%)',
              }}
            />

            {/* Tertiary deep blue accent glow */}
            <motion.div
              className="absolute inset-0 blur-[80px] pointer-events-none"
              animate={{
                opacity: phase === 'explode' ? [0.4, 0.8, 0] : phase === 'logo' ? 0.35 : 0,
                scale: phase === 'explode' ? [1, 4, 7] : 1,
              }}
              transition={{ duration: 2, delay: 0.15 }}
              style={{
                background: 'radial-gradient(circle, rgba(80, 120, 255, 0.55) 0%, transparent 55%)',
              }}
            />

            {/* APEX logo with premium 3D metallic effect */}
            <motion.div
              className="relative"
              style={{ perspective: '2500px' }}
            >
              {/* Ambient letter glow backdrop */}
              <motion.div
                className="absolute inset-0 blur-[120px] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: phase === 'logo' ? 0.6 : phase === 'explode' ? 0.9 : 0,
                }}
                transition={{ duration: 2.5, ease: 'easeOut' }}
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(140, 180, 255, 0.7) 0%, rgba(100, 150, 255, 0.35) 50%, transparent 75%)',
                }}
              />

              <motion.div
                initial={{ rotateX: -60, y: 150, opacity: 0 }}
                animate={{ 
                  rotateX: phase === 'buildup' ? -40 : 0, 
                  y: phase === 'buildup' ? 80 : 0,
                  opacity: 1,
                  scale: phase === 'explode' ? 1.12 : 1,
                }}
                transition={{ 
                  duration: 3.5,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <h1 className="text-8xl md:text-[12rem] font-black tracking-[0.12em] md:tracking-[0.02em] relative select-none flex justify-center whitespace-nowrap">
                  {'APEX'.split('').map((letter, i) => {
                    const letterDelay = 3 + i * 0.35;
                    
                    return (
                      <motion.div
                        key={i}
                        className="inline-block relative"
                        initial={{ 
                          opacity: 0, 
                          y: 80,
                          scale: 0.6,
                          rotateY: -20,
                        }}
                        animate={{ 
                          opacity: phase === 'buildup' ? 0.25 : 1, 
                          y: 0,
                          scale: phase === 'explode' ? 1.08 : 1,
                          rotateY: 0,
                          filter: phase === 'explode' 
                            ? 'drop-shadow(0 0 80px rgba(140, 180, 255, 1)) drop-shadow(0 0 120px rgba(100, 150, 255, 0.8))'
                            : phase === 'logo'
                            ? 'drop-shadow(0 0 40px rgba(160, 200, 255, 0.85)) drop-shadow(0 0 80px rgba(140, 180, 255, 0.5))'
                            : 'drop-shadow(0 0 20px rgba(180, 200, 255, 0.25))',
                        }}
                        transition={{
                          opacity: { duration: 1.8, delay: letterDelay, ease: 'easeOut' },
                          y: { duration: 2, delay: letterDelay, ease: [0.25, 0.1, 0.25, 1] },
                          scale: { duration: 1.2, delay: letterDelay, ease: 'easeOut' },
                          rotateY: { duration: 2.5, delay: letterDelay, ease: [0.25, 0.1, 0.25, 1] },
                          filter: { duration: 2, delay: letterDelay + 0.4, ease: 'easeOut' },
                        }}
                        style={{
                          // STABILITY FIX: Use backgroundImage instead of background to avoid
                          // shorthand/longhand property conflict warnings with backgroundClip
                          backgroundImage: phase === 'explode'
                            ? 'linear-gradient(180deg, #ffffff 0%, #f0f4ff 15%, #d0e0ff 40%, #a8c8ff 65%, #80b0ff 100%)'
                            : phase === 'logo'
                            ? 'linear-gradient(180deg, #ffffff 0%, #f5f8ff 20%, #dce8ff 45%, #c0d8ff 70%, #a0c4ff 100%)'
                            : 'linear-gradient(180deg, #888888 0%, #666666 50%, #444444 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        {letter}
                        
                        {/* Shimmer sweep effect */}
                        <motion.span
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            // STABILITY FIX: Use backgroundImage to avoid shorthand conflict
                            backgroundImage: 'linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.6) 50%, transparent 75%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }}
                          initial={{ x: '-200%' }}
                          animate={{ 
                            x: phase === 'logo' || phase === 'explode' ? '200%' : '-200%',
                          }}
                          transition={{
                            duration: 2.5,
                            delay: 6 + i * 0.2,
                            ease: [0.25, 0.1, 0.25, 1],
                          }}
                        >
                          {letter}
                        </motion.span>
                      </motion.div>
                    );
                  })}
                </h1>

                {/* Soft reflection below text */}
                <motion.div
                  className="absolute left-0 right-0 flex justify-center pointer-events-none overflow-hidden"
                  style={{ 
                    top: '100%',
                    height: '5rem',
                    transform: 'scaleY(-0.4)',
                    transformOrigin: 'top center',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: phase === 'logo' || phase === 'explode' ? 0.15 : 0,
                  }}
                  transition={{ duration: 2, delay: 5, ease: 'easeOut' }}
                >
                  <span 
                    className="text-8xl md:text-[12rem] font-black tracking-[0.12em] md:tracking-[0.02em]"
                    style={{
                      // STABILITY FIX: Use backgroundImage to avoid shorthand conflict
                      backgroundImage: 'linear-gradient(180deg, rgba(160, 200, 255, 0.85) 0%, transparent 55%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'blur(4px)',
                    }}
                  >
                    APEX
                  </span>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Tagline with elegant reveal */}
            <motion.div
              className="mt-8 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'logo' || phase === 'explode' ? 1 : 0 }}
              transition={{ duration: 1.2, delay: 3 }}
            >
              <motion.p
                className="text-xl md:text-3xl tracking-[0.3em] md:tracking-[0.5em] uppercase font-light"
                style={{ color: 'rgba(180, 200, 255, 0.85)' }}
                initial={{ y: 50, opacity: 0 }}
                animate={{ 
                  y: phase === 'logo' || phase === 'explode' ? 0 : 50,
                  opacity: phase === 'logo' || phase === 'explode' ? 1 : 0,
                }}
                transition={{ duration: 1.5, delay: 3, ease: [0.16, 1, 0.3, 1] }}
              >
                Discover Gallery
              </motion.p>
            </motion.div>

            {/* Decorative premium gradient line */}
            <motion.div
              className="mt-10 h-[2px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(140, 180, 255, 0.7), rgba(200, 220, 255, 0.9), rgba(140, 180, 255, 0.7), transparent)',
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ 
                width: phase === 'logo' || phase === 'explode' ? 250 : 0,
                opacity: phase === 'logo' ? 1 : phase === 'explode' ? 0 : 0,
              }}
              transition={{ duration: 1.5, delay: 3.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.div>

          {/* Epic premium blue/silver particle explosion */}
          {phase === 'explode' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              {particles.map((particle) => {
                const rad = (particle.angle * Math.PI) / 180;
                const x = Math.cos(rad) * particle.distance;
                const y = Math.sin(rad) * particle.distance;
                const colorType = particle.id % 4;
                
                return (
                  <motion.div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                      width: particle.size,
                      height: particle.size,
                      background: colorType === 0
                        ? `radial-gradient(circle, rgba(140, 180, 255, ${particle.opacity}) 0%, rgba(100, 150, 255, 0.4) 50%, transparent 100%)`
                        : colorType === 1
                        ? `radial-gradient(circle, rgba(220, 230, 255, ${particle.opacity}) 0%, rgba(200, 215, 255, 0.35) 50%, transparent 100%)`
                        : colorType === 2
                        ? `radial-gradient(circle, rgba(180, 200, 255, ${particle.opacity}) 0%, rgba(160, 185, 255, 0.38) 50%, transparent 100%)`
                        : `radial-gradient(circle, rgba(255, 255, 255, ${particle.opacity * 0.9}) 0%, rgba(230, 240, 255, 0.3) 50%, transparent 100%)`,
                      boxShadow: colorType === 0
                        ? `0 0 ${particle.size * 2.5}px rgba(100, 150, 255, 0.95), 0 0 ${particle.size * 5}px rgba(80, 120, 255, 0.55)`
                        : colorType === 3
                        ? `0 0 ${particle.size * 3}px rgba(255, 255, 255, 0.9), 0 0 ${particle.size * 6}px rgba(200, 220, 255, 0.5)`
                        : `0 0 ${particle.size * 2.5}px rgba(200, 220, 255, 0.9), 0 0 ${particle.size * 5}px rgba(180, 200, 255, 0.5)`,
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                    animate={{ 
                      x, 
                      y, 
                      opacity: [1, 1, 0.7, 0],
                      scale: [0, 1.5, 1.2, 0.3],
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

          {/* Premium blue/silver ring expansions */}
          {phase === 'explode' && (
            <>
              {[0, 0.12, 0.25, 0.4, 0.55, 0.7].map((delay, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full z-25"
                  style={{
                    width: 10,
                    height: 10,
                    border: i % 2 === 0
                      ? `${4 - i * 0.4}px solid rgba(140, 180, 255, ${0.9 - i * 0.12})`
                      : `${4 - i * 0.4}px solid rgba(200, 220, 255, ${0.85 - i * 0.1})`,
                    boxShadow: `0 0 ${25 - i * 3}px rgba(100, 150, 255, ${0.5 - i * 0.06})`,
                  }}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 120 + i * 35, opacity: 0 }}
                  transition={{ 
                    duration: 2 + i * 0.25, 
                    delay, 
                    ease: [0.16, 1, 0.3, 1] 
                  }}
                />
              ))}
            </>
          )}

          {/* Dramatic premium blue/silver final flash sequence */}
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'wipe' ? [0, 1, 0.9, 0.7] : 0,
            }}
            transition={{ duration: 1.5 }}
            style={{
              background: 'radial-gradient(circle at center, rgba(200, 220, 255, 1) 0%, rgba(140, 180, 255, 0.9) 25%, rgba(100, 150, 255, 0.7) 45%, rgba(60, 100, 200, 0.4) 65%, black 100%)',
            }}
          />

          {/* Film grain overlay for premium feel */}
          <motion.div 
            className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay z-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Vignette overlay */}
          <div 
            className="absolute inset-0 pointer-events-none z-45"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.5) 100%)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}));

export default CinematicTransition;
