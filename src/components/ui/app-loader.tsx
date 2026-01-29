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

export function AppLoader({ message, className }: AppLoaderProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const displayMessage = message || CINEMATIC_MESSAGES[currentMessageIndex];

  useEffect(() => {
    if (message) return; // Don't cycle if custom message provided
    
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
      {/* Premium glossy background with parallax effect */}
      <motion.div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.5 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      
      {/* Animated light rays */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-[200%] w-px"
            style={{
              left: `${15 + i * 15}%`,
              background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.03), transparent)',
              transformOrigin: 'top',
            }}
            initial={{ y: '-100%', rotate: -15 + i * 5 }}
            animate={{ y: '100%' }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'linear',
            }}
          />
        ))}
      </div>
      
      {/* Cinematic vignette overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 10%, rgba(0,0,0,0.8) 100%)',
        }}
      />
      
      {/* Horizontal film grain lines */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
        }}
      />
      
      <div className="relative flex flex-col items-center gap-10">
        {/* Epic logo with particle effects */}
        <div className="relative">
          {/* Orbiting particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/40"
              style={{
                left: '50%',
                top: '50%',
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 4) * 60, 0],
                y: [0, Math.sin((i * Math.PI) / 4) * 60, 0],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
          
          {/* Pulsing outer ring */}
          <motion.div 
            className="absolute inset-[-30px] rounded-full border border-white/10"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
          />
          
          {/* Secondary ring */}
          <motion.div 
            className="absolute inset-[-15px] rounded-full border border-white/20"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: 'easeInOut',
              delay: 0.3,
            }}
          />
          
          {/* Ambient glow */}
          <motion.div 
            className="absolute inset-[-40px] rounded-full blur-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(100,150,255,0.15) 0%, transparent 70%)',
            }}
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
          />
          
          {/* Main logo container */}
          <motion.div 
            className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-2xl border border-white/20 flex items-center justify-center shadow-2xl overflow-hidden"
            initial={{ scale: 0.8, opacity: 0, rotateY: -90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
            
            {/* Logo text with gradient */}
            <motion.span 
              className="text-3xl font-display font-bold bg-gradient-to-br from-white to-white/70 bg-clip-text text-transparent tracking-tight relative z-10"
              animate={{ 
                textShadow: [
                  '0 0 20px rgba(255,255,255,0.3)',
                  '0 0 40px rgba(255,255,255,0.5)',
                  '0 0 20px rgba(255,255,255,0.3)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              A–S
            </motion.span>
            
            {/* Premium shimmer effect */}
            <motion.div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
              }}
              animate={{ x: ['-150%', '150%'] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatDelay: 2,
                ease: 'easeInOut'
              }}
            />
            
            {/* Top shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </motion.div>
        </div>
        
        {/* Cinematic loading bar */}
        <div className="flex flex-col items-center gap-5 w-64">
          {/* Progress bar container */}
          <div className="relative w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
            {/* Animated progress */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400/80 via-white to-blue-400/80 rounded-full"
              initial={{ width: '0%' }}
              animate={{ 
                width: ['0%', '30%', '60%', '80%', '100%', '0%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            
            {/* Glow effect */}
            <motion.div
              className="absolute inset-y-[-4px] left-0 w-8 bg-white/30 blur-md"
              animate={{ left: ['-10%', '100%'] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
          
          {/* Message with typewriter effect */}
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
        
        {/* Brand signature */}
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
          
          {/* Subtle tagline */}
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
