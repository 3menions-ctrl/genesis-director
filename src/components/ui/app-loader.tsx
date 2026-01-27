import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import landingAbstractBg from '@/assets/landing-abstract-bg.jpg';

interface AppLoaderProps {
  message?: string;
  className?: string;
}

export function AppLoader({ message = 'Loading...', className }: AppLoaderProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center bg-black",
      className
    )}>
      {/* Premium glossy background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
        style={{ backgroundImage: `url(${landingAbstractBg})` }}
      />
      
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo with elegant glow */}
        <div className="relative">
          {/* Outer glow ring */}
          <motion.div 
            className="absolute inset-[-20px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
            }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
          />
          
          {/* Main logo container */}
          <motion.div 
            className="relative w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="text-2xl font-display font-bold text-white tracking-tight">AS</span>
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  repeatDelay: 1.5,
                  ease: 'easeInOut'
                }}
              />
            </div>
          </motion.div>
        </div>
        
        {/* Loading indicator */}
        <div className="flex flex-col items-center gap-4">
          {/* Elegant dots loader */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-white/60"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
          
          {/* Message */}
          <AnimatePresence mode="wait">
            <motion.p 
              key={message}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-white/60 font-medium tracking-wide"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>
        
        {/* Brand name */}
        <motion.p 
          className="text-white/30 text-xs font-medium tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Apex Studio
        </motion.p>
      </div>
    </div>
  );
}
