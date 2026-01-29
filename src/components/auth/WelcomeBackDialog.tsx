import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';

interface WelcomeBackDialogProps {
  isOpen: boolean;
  onComplete: () => void;
  userName?: string;
}

// Particle component for the epic effect
const Particle = ({ delay, index }: { delay: number; index: number }) => {
  const angle = (index / 20) * Math.PI * 2;
  const distance = 150 + Math.random() * 100;
  
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full"
      style={{
        background: `linear-gradient(135deg, 
          hsl(${200 + index * 8}, 80%, 70%), 
          hsl(${220 + index * 5}, 90%, 80%))`,
        boxShadow: `0 0 10px hsl(${200 + index * 8}, 80%, 70%)`,
        left: '50%',
        top: '50%',
      }}
      initial={{ 
        x: 0, 
        y: 0, 
        opacity: 0, 
        scale: 0 
      }}
      animate={{
        x: [0, Math.cos(angle) * distance * 0.5, Math.cos(angle) * distance],
        y: [0, Math.sin(angle) * distance * 0.5, Math.sin(angle) * distance],
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 2,
        delay: delay + 0.8,
        ease: "easeOut",
      }}
    />
  );
};

// Orbiting ring
const OrbitRing = ({ size, duration, delay, opacity }: { 
  size: number; 
  duration: number; 
  delay: number;
  opacity: number;
}) => (
  <motion.div
    className="absolute rounded-full border"
    style={{
      width: size,
      height: size,
      left: '50%',
      top: '50%',
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderColor: `rgba(255, 255, 255, ${opacity})`,
    }}
    initial={{ scale: 0, opacity: 0, rotate: 0 }}
    animate={{ 
      scale: [0, 1, 1.1, 1],
      opacity: [0, opacity, opacity * 0.5, 0],
      rotate: 360,
    }}
    transition={{
      duration: duration,
      delay: delay,
      ease: "easeOut",
    }}
  />
);

// Light ray component
const LightRay = ({ angle, delay }: { angle: number; delay: number }) => (
  <motion.div
    className="absolute origin-center"
    style={{
      width: 2,
      height: 200,
      left: '50%',
      top: '50%',
      background: 'linear-gradient(to top, transparent, rgba(255,255,255,0.3), transparent)',
      transform: `rotate(${angle}deg) translateY(-50%)`,
    }}
    initial={{ scaleY: 0, opacity: 0 }}
    animate={{ 
      scaleY: [0, 1, 0],
      opacity: [0, 0.6, 0],
    }}
    transition={{
      duration: 1.5,
      delay: delay,
      ease: "easeOut",
    }}
  />
);

export function WelcomeBackDialog({ isOpen, onComplete, userName }: WelcomeBackDialogProps) {
  const [phase, setPhase] = useState<'entrance' | 'celebrate' | 'exit'>('entrance');
  const [showContent, setShowContent] = useState(false);

  const handleComplete = useCallback(() => {
    setPhase('exit');
    setTimeout(onComplete, 600);
  }, [onComplete]);

  useEffect(() => {
    if (isOpen) {
      setPhase('entrance');
      setShowContent(false);
      
      // Show content after entrance
      const contentTimer = setTimeout(() => {
        setShowContent(true);
        setPhase('celebrate');
      }, 400);

      // Auto-close after celebration
      const closeTimer = setTimeout(() => {
        handleComplete();
      }, 3500);

      return () => {
        clearTimeout(contentTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, handleComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Cinematic backdrop */}
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            exit={{ opacity: 0 }}
          />

          {/* Animated gradient background */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Light rays burst */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <LightRay key={i} angle={i * 30} delay={0.5 + i * 0.05} />
            ))}
          </div>

          {/* Orbiting rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <OrbitRing size={200} duration={3} delay={0.3} opacity={0.2} />
            <OrbitRing size={280} duration={3.5} delay={0.5} opacity={0.15} />
            <OrbitRing size={360} duration={4} delay={0.7} opacity={0.1} />
          </div>

          {/* Particle explosion */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <Particle key={i} delay={i * 0.02} index={i} />
            ))}
          </div>

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: phase === 'exit' ? 0.9 : 1, 
              opacity: phase === 'exit' ? 0 : 1 
            }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 20,
              duration: 0.5
            }}
          >
            {/* Animated logo */}
            <motion.div
              className="relative mb-8"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 150, 
                damping: 15,
                delay: 0.2
              }}
            >
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(147, 51, 234, 0.5))',
                  filter: 'blur(20px)',
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              {/* Logo container */}
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
                <motion.span 
                  className="text-4xl font-display font-bold text-white"
                  animate={{ 
                    textShadow: [
                      '0 0 20px rgba(255,255,255,0.5)',
                      '0 0 40px rgba(255,255,255,0.8)',
                      '0 0 20px rgba(255,255,255,0.5)',
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  A–S
                </motion.span>
                
                {/* Sparkle accents */}
                <motion.div
                  className="absolute -top-2 -right-2"
                  animate={{ 
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-6 h-6 text-yellow-400" style={{ filter: 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.8))' }} />
                </motion.div>
              </div>
            </motion.div>

            {/* Welcome text */}
            <AnimatePresence>
              {showContent && (
                <>
                  <motion.div
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="mb-2"
                  >
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium text-white/80">Session restored</span>
                    </span>
                  </motion.div>

                  <motion.h1
                    className="text-4xl sm:text-5xl md:text-6xl font-display font-bold text-white mb-4"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    style={{
                      textShadow: '0 0 60px rgba(255,255,255,0.3)',
                    }}
                  >
                    Welcome back{userName ? `, ${userName}` : ''}!
                  </motion.h1>

                  <motion.p
                    className="text-lg text-white/60 mb-8 max-w-md"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                  >
                    Your creative studio is ready. Let's make something amazing.
                  </motion.p>

                  {/* Continue button */}
                  <motion.button
                    onClick={handleComplete}
                    className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white text-black font-semibold text-lg shadow-2xl hover:bg-white/90 transition-all duration-300"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      boxShadow: '0 0 40px rgba(255,255,255,0.2), 0 20px 40px -10px rgba(0,0,0,0.5)',
                    }}
                  >
                    <span>Enter Studio</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                </>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom gradient fade */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            }}
          />

          {/* Noise texture overlay */}
          <div 
            className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
