import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

const CINEMATIC_MESSAGES = [
  'Initializing studio...',
  'Loading creative engine...',
  'Preparing your workspace...',
];

// Pre-computed particle positions for deterministic animations
const PARTICLE_POSITIONS = [
  { angle: 0, delay: 0 },
  { angle: 45, delay: 0.2 },
  { angle: 90, delay: 0.4 },
  { angle: 135, delay: 0.6 },
  { angle: 180, delay: 0.8 },
  { angle: 225, delay: 1.0 },
  { angle: 270, delay: 1.2 },
  { angle: 315, delay: 1.4 },
];

// Pre-computed light ray positions
const LIGHT_RAYS = [
  { left: '15%', rotate: -10, duration: 4, delay: 0 },
  { left: '30%', rotate: -5, duration: 4.5, delay: 0.3 },
  { left: '45%', rotate: 0, duration: 5, delay: 0.6 },
  { left: '60%', rotate: 5, duration: 4.7, delay: 0.9 },
  { left: '75%', rotate: 10, duration: 5.2, delay: 1.2 },
  { left: '90%', rotate: 15, duration: 4.3, delay: 1.5 },
];

export function AppLoader({ message, className }: AppLoaderProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const displayMessage = message || CINEMATIC_MESSAGES[currentMessageIndex];

  useEffect(() => {
    if (message) return;
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % CINEMATIC_MESSAGES.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center bg-black overflow-hidden",
      className
    )}>
      {/* Premium background - single motion for entry, then static */}
      <motion.div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      
      {/* Light rays - CSS animated for GPU acceleration */}
      <div className="absolute inset-0 overflow-hidden">
        {LIGHT_RAYS.map((ray, i) => (
          <div
            key={i}
            className="absolute h-[200%] w-px animate-[loader-light-ray_4s_linear_infinite] will-change-transform"
            style={{
              left: ray.left,
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.03), transparent)',
              transform: `rotate(${ray.rotate}deg)`,
              animationDuration: `${ray.duration}s`,
              animationDelay: `${ray.delay}s`,
            }}
          />
        ))}
      </div>
      
      {/* Cinematic vignette overlay - static, no animation */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      
      {/* Film grain lines - static texture */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
        }}
      />
      
      <div className="relative flex flex-col items-center gap-10">
        {/* Logo with CSS-animated effects */}
        <div className="relative">
          {/* Orbiting particles - CSS animated */}
          {PARTICLE_POSITIONS.map((pos, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/40 animate-loader-particle will-change-transform"
              style={{
                left: '50%',
                top: '50%',
                '--particle-end': `translate(${Math.cos((pos.angle * Math.PI) / 180) * 60}px, ${Math.sin((pos.angle * Math.PI) / 180) * 60}px)`,
                animationDelay: `${pos.delay}s`,
              } as React.CSSProperties}
            />
          ))}
          
          {/* Pulsing outer ring - CSS animated */}
          <div className="absolute inset-[-30px] rounded-full border border-white/10 animate-loader-ring-pulse will-change-transform" />
          
          {/* Secondary ring - CSS animated */}
          <div className="absolute inset-[-15px] rounded-full border border-white/20 animate-loader-ring-inner will-change-transform" />
          
          {/* Ambient glow - CSS animated */}
          <div 
            className="absolute inset-[-40px] rounded-full blur-2xl animate-loader-glow will-change-transform"
            style={{
              background: 'radial-gradient(circle, rgba(100,150,255,0.15) 0%, transparent 70%)',
            }}
          />
          
          {/* Main logo container - single entry animation */}
          <motion.div 
            className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center shadow-2xl overflow-hidden"
            initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Inner glow - static */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            
            {/* Logo text - static with CSS text-shadow animation */}
            <span className="text-3xl font-display font-bold bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent tracking-tight relative z-10 animate-pulse-glow">
              A–S
            </span>
            
            {/* Premium shimmer effect - CSS animated */}
            <div 
              className="absolute inset-0 animate-shimmer will-change-transform"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
                animationDuration: '4s',
              }}
            />
            
            {/* Top shine line - static */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </motion.div>
        </div>
        
        {/* Loading bar - CSS animated */}
        <div className="flex flex-col items-center gap-5 w-64">
          <div className="relative w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
            {/* Animated progress - CSS keyframes */}
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400/80 via-white to-blue-400/80 rounded-full animate-loader-progress will-change-transform" />
            
            {/* Glow effect - CSS animated */}
            <div className="absolute inset-y-[-4px] w-8 bg-white/30 blur-md animate-loader-shine will-change-transform" />
          </div>
          
          {/* Message with typewriter effect - only this uses Framer for text transitions */}
          <AnimatePresence mode="wait">
            <motion.p 
              key={displayMessage}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.4 }}
              className="text-sm text-white/60 font-medium tracking-wide text-center"
            >
              {displayMessage}
            </motion.p>
          </AnimatePresence>
        </div>
        
        {/* Brand signature - single entry animation */}
        <motion.div 
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-8 h-px bg-gradient-to-r from-transparent to-white/20"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            />
            <p className="text-white/30 text-xs font-medium tracking-[0.3em] uppercase">
              Apex Studio
            </p>
            <motion.div 
              className="w-8 h-px bg-gradient-to-l from-transparent to-white/20"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            />
          </div>
          
          <motion.p 
            className="text-white/15 text-[10px] tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            Cinema-Grade AI Video
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
