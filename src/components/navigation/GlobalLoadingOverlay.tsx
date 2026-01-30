/**
 * GlobalLoadingOverlay - Premium animated loading screen
 * 
 * Features:
 * - Smooth fade-in/out transitions (300ms)
 * - Brand-aligned shimmer animation
 * - Progressive loading messages
 * - Progress indicator
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';

// Brand shimmer animation
const ShimmerBar = memo(function ShimmerBar({ progress }: { progress: number }) {
  return (
    <div className="relative w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
      {/* Progress fill */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      
      {/* Shimmer overlay */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ x: ['-100%', '400%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </div>
  );
});

// Animated logo/spinner
const BrandSpinner = memo(function BrandSpinner() {
  return (
    <div className="relative w-20 h-20">
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-violet-500/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute inset-2 rounded-full border-2 border-fuchsia-500/40"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      
      {/* Inner glow */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20"
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Center dot */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.div
          className="w-3 h-3 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400"
          animate={{ 
            scale: [1, 1.3, 1],
            boxShadow: [
              '0 0 10px rgba(139, 92, 246, 0.5)',
              '0 0 25px rgba(139, 92, 246, 0.8)',
              '0 0 10px rgba(139, 92, 246, 0.5)',
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
});

export const GlobalLoadingOverlay = memo(function GlobalLoadingOverlay() {
  const { state } = useNavigationLoading();
  const [isVisible, setIsVisible] = useState(false);
  
  // Delay visibility to prevent flash on fast navigations
  useEffect(() => {
    if (state.isLoading) {
      // Show immediately for heavy routes
      setIsVisible(true);
    } else {
      // Small delay before hiding to complete fade-out
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [state.isLoading]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ 
            background: 'linear-gradient(135deg, #030303 0%, #0a0a0a 50%, #050505 100%)',
          }}
        >
          {/* Subtle background pattern */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 50%)`,
            }}
          />
          
          {/* Ambient glow */}
          <motion.div
            className="absolute w-96 h-96 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          {/* Content container */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="relative z-10 flex flex-col items-center gap-8"
          >
            {/* Brand spinner */}
            <BrandSpinner />
            
            {/* Progress bar */}
            <ShimmerBar progress={state.progress} />
            
            {/* Dynamic message */}
            <motion.div
              key={state.currentMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <p className="text-white/70 text-sm font-medium tracking-wide">
                {state.currentMessage || 'Loading...'}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default GlobalLoadingOverlay;
