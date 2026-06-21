/**
 * GlobalLoadingOverlay - Uses unified CinemaLoader component
 * 
 * Provides consistent dark-themed loading experience across all route transitions.
 * Features smooth 0.3s fade transitions and memory cleanup.
 */

import { memo, useEffect, useState, useCallback, forwardRef } from 'react';
import { useNavigationLoading } from '@/contexts/NavigationLoadingContext';
import { CinemaLoader } from '@/components/ui/CinemaLoader';

export const GlobalLoadingOverlay = memo(forwardRef<HTMLDivElement, Record<string, never>>(
  function GlobalLoadingOverlay(_, ref) {
    const { state } = useNavigationLoading();
    const [isVisible, setIsVisible] = useState(false);
  
  // Manage visibility with delay to prevent flash on fast navigations
  useEffect(() => {
    if (state.isLoading) {
      setIsVisible(true);
    } else {
      // Small delay before hiding to complete fade-out
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [state.isLoading]);

  // Cleanup callback for memory management
  const handleExitComplete = useCallback(() => {
    // Force garbage collection hint for animation resources
    setIsVisible(false);
  }, []);

    // Only render when visible or transitioning out
    if (!isVisible && !state.isLoading) {
      return null;
    }

    return (
      <CinemaLoader
        ref={ref}
        isVisible={isVisible}
        message={state.currentMessage || 'Loading...'}
        progress={state.progress}
        showProgress={true}
        onExitComplete={handleExitComplete}
        variant="fullscreen"
      />
    );
  }
));

GlobalLoadingOverlay.displayName = 'GlobalLoadingOverlay';

export default GlobalLoadingOverlay;
