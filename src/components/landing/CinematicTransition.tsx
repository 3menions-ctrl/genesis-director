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
  const [phase, setPhase] = useState<'idle' | 'buildup' | 'logo' | 'explode' | 'wipe' | 'complete'>('idle');

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }

    // Phase 0: Buildup tension (0-1s)
    setPhase('buildup');

    // Phase 1: Logo reveal (1-3.5s)
    const logoTimer = setTimeout(() => {
      setPhase('logo');
    }, 1000);
    
    // Phase 2: Particle explosion (3.5-5.5s)
    const explodeTimer = setTimeout(() => {
      setPhase('explode');
    }, 3500);

    // Phase 3: Wipe transition (5.5-7s)
    const wipeTimer = setTimeout(() => {
      setPhase('wipe');
    }, 5500);

    // Complete (7s+)
    const completeTimer = setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 7000);

    return () => {
      clearTimeout(logoTimer);
      clearTimeout(explodeTimer);
      clearTimeout(wipeTimer);
      clearTimeout(completeTimer);
    };
  }, [isActive, onComplete]);

  // Generate particle positions - more particles for epic effect
  const particles = Array.from({ length: 120 }, (_, i) => ({
    id: i,
    angle: (i * 3) + Math.random() * 8,
    distance: 200 + Math.random() * 600,
    size: 2 + Math.random() * 8,
    delay: Math.random() * 0.5,
    duration: 1.2 + Math.random() * 0.6,
    opacity: 0.6 + Math.random() * 0.4,
  }));

  // Starburst rays - more rays for premium feel
  const rays = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: i * 15,
    delay: i * 0.03,
    width: i % 3 === 0 ? 3 : 1,
  }));

  // Floating orbs for ambient effect
  const orbs = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: Math.cos((i * Math.PI * 2) / 8) * 300,
    y: Math.sin((i * Math.PI * 2) / 8) * 200,
    size: 60 + Math.random() * 100,
    delay: i * 0.15,
  }));

  return (
    <AnimatePresence>
      {isActive && phase !== 'complete' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
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
            transition={{ duration: 0.8 }}
            style={{
              background: 'radial-gradient(ellipse at center, #0a0a12 0%, #000000 70%)',
            }}
          />

          {/* Premium blue/silver ambient pulse glow */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'buildup' ? [0, 0.4, 0.15, 0.5, 0.25] : 
                       phase === 'logo' ? 0.6 :
                       phase === 'explode' ? [0.6, 1, 0] : 0,
            }}
            transition={{ 
              duration: phase === 'buildup' ? 1 : 1.5,
              ease: "easeInOut",
            }}
            style={{
              background: 'radial-gradient(ellipse at center, rgba(100, 150, 255, 0.2) 0%, rgba(180, 200, 255, 0.1) 30%, transparent 60%)',
            }}
          />

          {/* Secondary silver glow layer */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: phase === 'logo' || phase === 'explode' ? 0.3 : 0,
            }}
            transition={{ duration: 1.5 }}
            style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(200, 220, 255, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(140, 180, 255, 0.12) 0%, transparent 50%)',
            }}
          />

          {/* Floating premium blue/silver orbs */}
          {(phase === 'buildup' || phase === 'logo') && orbs.map((orb) => (
            <motion.div
              key={orb.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: orb.size,
                height: orb.size,
                background: orb.id % 2 === 0 
                  ? 'radial-gradient(circle, rgba(100, 150, 255, 0.15) 0%, rgba(140, 180, 255, 0.05) 50%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(180, 200, 255, 0.12) 0%, rgba(220, 230, 255, 0.04) 50%, transparent 70%)',
                filter: 'blur(25px)',
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ 
                x: orb.x,
                y: orb.y,
                opacity: [0, 0.7, 0.4, 0.6],
                scale: [0, 1.3, 1, 1.1],
              }}
              transition={{
                duration: 2.5,
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
              height: phase === 'wipe' ? '100%' : '10%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 1.2 : 1,
              ease: [0.65, 0, 0.35, 1],
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-black z-50"
            initial={{ height: 0 }}
            animate={{ 
              height: phase === 'wipe' ? '100%' : '10%',
            }}
            transition={{ 
              duration: phase === 'wipe' ? 1.2 : 1,
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
                    height: '200vh',
                    transform: `rotate(${ray.angle}deg)`,
                    background: ray.id % 3 === 0 
                      ? `linear-gradient(to top, 
                          transparent 0%, 
                          rgba(100, 150, 255, 0.08) 20%,
                          rgba(140, 180, 255, ${ray.width === 3 ? 0.4 : 0.2}) 45%, 
                          rgba(180, 210, 255, ${ray.width === 3 ? 0.6 : 0.35}) 50%, 
                          rgba(140, 180, 255, ${ray.width === 3 ? 0.4 : 0.2}) 55%, 
                          rgba(100, 150, 255, 0.08) 80%,
                          transparent 100%)`
                      : `linear-gradient(to top, 
                          transparent 0%, 
                          rgba(200, 215, 255, 0.06) 20%,
                          rgba(220, 230, 255, ${ray.width === 3 ? 0.35 : 0.18}) 45%, 
                          rgba(240, 245, 255, ${ray.width === 3 ? 0.55 : 0.3}) 50%, 
                          rgba(220, 230, 255, ${ray.width === 3 ? 0.35 : 0.18}) 55%, 
                          rgba(200, 215, 255, 0.06) 80%,
                          transparent 100%)`,
                  }}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ 
                    scaleY: phase === 'explode' ? [0.5, 1.5, 0] : [0, 0.5],
                    opacity: phase === 'explode' ? [0.85, 1, 0] : [0, 0.7],
                  }}
                  transition={{ 
                    duration: phase === 'explode' ? 1.2 : 1.5,
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
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ 
              scale: phase === 'buildup' ? 0.5 :
                     phase === 'logo' ? 1 :
                     phase === 'explode' ? 1.3 : 1,
              opacity: phase === 'wipe' ? 0 : 1,
            }}
            transition={{ 
              duration: 1.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Multi-layer premium blue/silver logo glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ transform: 'scale(3)' }}
              animate={{
                opacity: phase === 'explode' ? [0.4, 0.9, 0] : 
                         phase === 'logo' ? [0, 0.4, 0.25, 0.5] : 0.15,
              }}
              transition={{ duration: 1.5 }}
            >
              <div 
                className="w-full h-full blur-[100px]"
                style={{
                  background: 'radial-gradient(circle, rgba(140, 180, 255, 0.5) 0%, rgba(100, 150, 255, 0.3) 30%, transparent 60%)',
                }}
              />
            </motion.div>

            {/* Secondary silver glow layer */}
            <motion.div
              className="absolute inset-0 blur-[40px] pointer-events-none"
              animate={{
                opacity: phase === 'explode' ? [0.6, 1, 0] : 0.5,
                scale: phase === 'explode' ? [1, 2.5, 4] : 1,
              }}
              transition={{ duration: 1.2 }}
              style={{
                background: 'radial-gradient(circle, rgba(200, 220, 255, 0.7) 0%, rgba(160, 190, 255, 0.4) 40%, transparent 60%)',
              }}
            />

            {/* Tertiary deep blue accent glow */}
            <motion.div
              className="absolute inset-0 blur-[60px] pointer-events-none"
              animate={{
                opacity: phase === 'explode' ? [0.3, 0.7, 0] : phase === 'logo' ? 0.3 : 0,
                scale: phase === 'explode' ? [1, 3, 5] : 1,
              }}
              transition={{ duration: 1.4, delay: 0.1 }}
              style={{
                background: 'radial-gradient(circle, rgba(80, 120, 255, 0.5) 0%, transparent 50%)',
              }}
            />

            {/* APEX logo with premium 3D metallic effect */}
            <motion.div
              className="relative"
              style={{ perspective: '1500px' }}
            >
              {/* Ambient letter glow backdrop */}
              <motion.div
                className="absolute inset-0 blur-[80px] pointer-events-none"
                animate={{
                  opacity: phase === 'logo' || phase === 'explode' ? 0.6 : 0,
                }}
                transition={{ duration: 1.5 }}
                style={{
                  background: 'linear-gradient(90deg, rgba(100, 150, 255, 0.4), rgba(180, 200, 255, 0.5), rgba(140, 180, 255, 0.4))',
                }}
              />

              <motion.div
                initial={{ rotateX: -90, y: 150, opacity: 0 }}
                animate={{ 
                  rotateX: phase === 'buildup' ? -60 : 0, 
                  y: phase === 'buildup' ? 80 : 0,
                  opacity: phase === 'buildup' ? 0.5 : 1,
                  scale: phase === 'explode' ? [1, 1.15, 1.05] : 1,
                }}
                transition={{ 
                  duration: 1.8,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <h1 className="text-8xl md:text-[12rem] font-black tracking-[-0.02em] relative select-none">
                  {'APEX'.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      className="inline-block relative"
                      style={{
                        background: phase === 'explode'
                          ? 'linear-gradient(180deg, #ffffff 0%, #e0e8ff 25%, #b8caff 50%, #8fb0ff 75%, #6090ff 100%)'
                          : phase === 'logo'
                          ? 'linear-gradient(180deg, #ffffff 0%, #e8eeff 30%, #c0d4ff 60%, #a0c0ff 100%)'
                          : 'linear-gradient(180deg, #888888 0%, #666666 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        filter: phase === 'explode' 
                          ? 'drop-shadow(0 0 60px rgba(140, 180, 255, 1)) drop-shadow(0 0 120px rgba(100, 150, 255, 0.8)) drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
                          : phase === 'logo'
                          ? 'drop-shadow(0 0 30px rgba(180, 210, 255, 0.7)) drop-shadow(0 0 60px rgba(140, 180, 255, 0.4)) drop-shadow(0 4px 6px rgba(0,0,0,0.4))'
                          : 'drop-shadow(0 0 15px rgba(200, 220, 255, 0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }}
                      initial={{ opacity: 0, y: 80, rotateY: -45, scale: 0.8 }}
                      animate={{ 
                        opacity: phase !== 'buildup' ? 1 : 0.3, 
                        y: 0,
                        rotateY: 0,
                        scale: 1,
                      }}
                      transition={{
                        duration: 1.2,
                        delay: 1.2 + i * 0.18,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {/* Main letter */}
                      {letter}
                      
                      {/* Shimmer overlay effect */}
                      <motion.span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                        initial={{ x: '-100%' }}
                        animate={{ 
                          x: phase === 'logo' || phase === 'explode' ? ['100%', '100%'] : '-100%',
                        }}
                        transition={{
                          duration: 1.5,
                          delay: 2.5 + i * 0.1,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        {letter}
                      </motion.span>
                    </motion.span>
                  ))}
                </h1>

                {/* Reflection effect below text */}
                <motion.div
                  className="absolute -bottom-4 left-0 right-0 h-20 pointer-events-none overflow-hidden"
                  style={{ transform: 'scaleY(-0.3) translateY(-100%)' }}
                  animate={{
                    opacity: phase === 'logo' || phase === 'explode' ? 0.15 : 0,
                  }}
                  transition={{ duration: 1, delay: 2.2 }}
                >
                  <h1 
                    className="text-8xl md:text-[12rem] font-black tracking-[-0.02em]"
                    style={{
                      background: 'linear-gradient(180deg, rgba(140, 180, 255, 0.6) 0%, transparent 80%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'blur(2px)',
                    }}
                  >
                    APEX
                  </h1>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Tagline with elegant reveal */}
            <motion.div
              className="mt-6 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'logo' || phase === 'explode' ? 1 : 0 }}
              transition={{ duration: 0.8, delay: 2 }}
            >
              <motion.p
                className="text-xl md:text-2xl tracking-[0.4em] uppercase font-light"
                style={{ color: 'rgba(180, 200, 255, 0.8)' }}
                initial={{ y: 40 }}
                animate={{ y: phase === 'logo' || phase === 'explode' ? 0 : 40 }}
                transition={{ duration: 1, delay: 2, ease: [0.16, 1, 0.3, 1] }}
              >
                Discover Gallery
              </motion.p>
            </motion.div>

            {/* Decorative premium gradient line */}
            <motion.div
              className="mt-8 h-[1px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(140, 180, 255, 0.6), rgba(200, 220, 255, 0.8), rgba(140, 180, 255, 0.6), transparent)',
              }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ 
                width: phase === 'logo' || phase === 'explode' ? 200 : 0,
                opacity: phase === 'logo' ? 1 : phase === 'explode' ? 0 : 0,
              }}
              transition={{ duration: 1.2, delay: 2.3, ease: [0.16, 1, 0.3, 1] }}
            />
          </motion.div>

          {/* Epic premium blue/silver particle explosion */}
          {phase === 'explode' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
              {particles.map((particle) => {
                const rad = (particle.angle * Math.PI) / 180;
                const x = Math.cos(rad) * particle.distance;
                const y = Math.sin(rad) * particle.distance;
                const isBlue = particle.id % 3 !== 0;
                
                return (
                  <motion.div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                      width: particle.size,
                      height: particle.size,
                      background: isBlue
                        ? `radial-gradient(circle, rgba(140, 180, 255, ${particle.opacity}) 0%, rgba(100, 150, 255, 0.4) 50%, transparent 100%)`
                        : `radial-gradient(circle, rgba(220, 230, 255, ${particle.opacity}) 0%, rgba(200, 215, 255, 0.35) 50%, transparent 100%)`,
                      boxShadow: isBlue
                        ? `0 0 ${particle.size * 2}px rgba(100, 150, 255, 0.9), 0 0 ${particle.size * 4}px rgba(80, 120, 255, 0.5)`
                        : `0 0 ${particle.size * 2}px rgba(200, 220, 255, 0.85), 0 0 ${particle.size * 4}px rgba(180, 200, 255, 0.45)`,
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                    animate={{ 
                      x, 
                      y, 
                      opacity: [1, 1, 0.6, 0],
                      scale: [0, 1.3, 1.1, 0.4],
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
              {[0, 0.1, 0.2, 0.35, 0.5].map((delay, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full z-25"
                  style={{
                    width: 8,
                    height: 8,
                    border: i % 2 === 0
                      ? `${3 - i * 0.5}px solid rgba(140, 180, 255, ${0.85 - i * 0.15})`
                      : `${3 - i * 0.5}px solid rgba(200, 220, 255, ${0.8 - i * 0.12})`,
                    boxShadow: `0 0 ${20 - i * 3}px rgba(100, 150, 255, ${0.4 - i * 0.06})`,
                  }}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 100 + i * 30, opacity: 0 }}
                  transition={{ 
                    duration: 1.5 + i * 0.2, 
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
              opacity: phase === 'wipe' ? [0, 1, 0.85, 0] : 0,
            }}
            transition={{ duration: 0.6 }}
            style={{
              background: 'radial-gradient(circle at center, rgba(200, 220, 255, 1) 0%, rgba(140, 180, 255, 0.85) 30%, rgba(100, 150, 255, 0.6) 50%, transparent 100%)',
            }}
          />

          {/* Film grain overlay for premium feel */}
          <motion.div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Vignette overlay */}
          <div 
            className="absolute inset-0 pointer-events-none z-45"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.4) 100%)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
