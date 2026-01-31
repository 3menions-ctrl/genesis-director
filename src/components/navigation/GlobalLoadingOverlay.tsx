/**
 * GlobalLoadingOverlay - Premium animated loading screen
 * 
 * Features:
 * - Smooth fade-in/out transitions (300ms)
 * - Unified brand shimmer animation
 * - Progressive loading messages
 * - Progress indicator
 * - Uses UnifiedLoadingPage components for consistency
 */

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { BrandLoadingSpinner, Shimmer } from '@/components/ui/UnifiedLoadingPage';

// Shimmer progress bar
const ShimmerBar = memo(function ShimmerBar({ progress }: { progress: number }) {
  return (
    <div className="relative w-64 h-1.5 bg-muted/20 rounded-full overflow-hidden">
      {/* Progress fill */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-secondary to-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      
      {/* Shimmer overlay */}
      <Shimmer />
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
        >
          {/* Subtle background pattern */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.08) 0%, transparent 50%)`,
            }}
          />
          
          {/* Ambient glow */}
          <motion.div
            className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
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
            {/* Brand spinner - unified component */}
            <BrandLoadingSpinner size="md" />
            
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
              <p className="text-muted-foreground text-sm font-medium tracking-wide">
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
