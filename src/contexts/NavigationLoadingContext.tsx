/**
 * NavigationLoadingContext - Global Navigation Guard System
 * 
 * Provides smooth transitions between heavy-resource pages by:
 * - Intercepting navigation to show loading overlay
 * - Verifying critical assets are ready before dismissing
 * - Enforcing minimum display time to prevent flicker
 * - Progressive loading messages for user engagement
 * 
 * ARCHITECTURE: Uses centralized route config from routeConfig.ts
 * to ensure sync with NavigationGuardProvider.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useRef,
  useEffect,
  ReactNode 
} from 'react';
import { useLocation } from 'react-router-dom';
import { updateNavigationState } from '@/lib/diagnostics/StateSnapshotMonitor';
import { 
  HEAVY_ROUTES, 
  isHeavyRoute as checkHeavyRoute, 
  getHeavyRouteConfig 
} from '@/lib/navigation/routeConfig';

// Re-export for consumers who need the raw config
export { HEAVY_ROUTES };

interface NavigationLoadingState {
  isLoading: boolean;
  targetRoute: string | null;
  currentMessage: string;
  progress: number;
}

interface NavigationLoadingContextType {
  state: NavigationLoadingState;
  startNavigation: (targetRoute: string) => void;
  completeNavigation: () => void;
  reportReady: (systemName: string) => void;
  isHeavyRoute: (route: string) => boolean;
  /** Disable auto-complete for pages that manage their own readiness */
  disableAutoComplete: () => void;
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType | null>(null);

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<NavigationLoadingState>({
    isLoading: false,
    targetRoute: null,
    currentMessage: '',
    progress: 0,
  });
  
  const messageIndexRef = useRef(0);
  const messageIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const readySystemsRef = useRef<Set<string>>(new Set());
  const autoCompleteDisabledRef = useRef(false);
  const minDurationRef = useRef<number>(800);
  // FIX: Added refs for completion timeouts to prevent leaks
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use centralized route config - single source of truth
  const isHeavyRoute = useCallback((route: string): boolean => {
    return checkHeavyRoute(route);
  }, []);

  // Disable auto-complete for pages that manage their own readiness
  const disableAutoComplete = useCallback(() => {
    autoCompleteDisabledRef.current = true;
  }, []);

  // Start navigation loading
  const startNavigation = useCallback((targetRoute: string) => {
    const config = getHeavyRouteConfig(targetRoute);
    
    if (!config) {
      // Not a heavy route, no loading needed
      return;
    }

    // Clear any previous interval
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
    }

    // Reset state - including auto-complete flag for new navigation
    readySystemsRef.current.clear();
    autoCompleteDisabledRef.current = false;
    messageIndexRef.current = 0;
    startTimeRef.current = performance.now();
    minDurationRef.current = config.minDuration;

    setState({
      isLoading: true,
      targetRoute,
      currentMessage: config.messages[0] || 'Loading...',
      progress: 0,
    });
    
    // Update diagnostics state
    updateNavigationState({
      currentRoute: location.pathname,
      isLoading: true,
      targetRoute,
    }, 'startNavigation');

    // Cycle through messages
    const totalMessages = config.messages.length;
    const messageInterval = Math.max(300, config.minDuration / totalMessages);

    messageIntervalRef.current = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % totalMessages;
      const newProgress = Math.min(90, ((messageIndexRef.current + 1) / totalMessages) * 100);
      
      setState(prev => ({
        ...prev,
        currentMessage: config.messages[messageIndexRef.current],
        progress: newProgress,
      }));
    }, messageInterval);
  }, []);

  // Complete navigation (called when page is ready)
  // FIX: Uses refs declared above to prevent memory leaks on unmount
  const completeNavigation = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    const remaining = Math.max(0, minDurationRef.current - elapsed);

    // Clear any existing timeouts first
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Ensure minimum duration has passed
    completionTimeoutRef.current = setTimeout(() => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }

      setState(prev => ({
        ...prev,
        progress: 100,
      }));

      // Brief delay at 100% before hiding
      hideTimeoutRef.current = setTimeout(() => {
        setState({
          isLoading: false,
          targetRoute: null,
          currentMessage: '',
          progress: 0,
        });
        
        // Update diagnostics state
        updateNavigationState({
          currentRoute: location.pathname,
          isLoading: false,
          targetRoute: null,
        }, 'completeNavigation');
      }, 150);
    }, remaining);
  }, [location.pathname]);

  // Report a system as ready (for Promise.all verification)
  const reportReady = useCallback((systemName: string) => {
    readySystemsRef.current.add(systemName);
  }, []);

  // Auto-complete when route changes (fallback) - ONLY if auto-complete not disabled
  // Pages that manage their own readiness via onReady callbacks should call disableAutoComplete()
  useEffect(() => {
    if (state.isLoading && state.targetRoute === location.pathname) {
      // Skip auto-complete if page manages its own readiness
      if (autoCompleteDisabledRef.current) {
        return;
      }
      
      // Route has changed to target, auto-complete after a brief delay
      // This is a fallback for pages that don't explicitly call markReady()
      const timer = setTimeout(() => {
        completeNavigation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, state.isLoading, state.targetRoute, completeNavigation]);

  // Cleanup on unmount - FIX: Added cleanup for completion timeouts
  useEffect(() => {
    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
      }
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <NavigationLoadingContext.Provider 
      value={{ 
        state, 
        startNavigation, 
        completeNavigation, 
        reportReady,
        isHeavyRoute,
        disableAutoComplete,
      }}
    >
      {children}
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  const context = useContext(NavigationLoadingContext);
  if (!context) {
    // Return a safe fallback instead of throwing - prevents crashes during SSR or provider issues
    console.warn('[NavigationLoading] Context not available, using fallback');
    return {
      state: { isLoading: false, targetRoute: null, currentMessage: '', progress: 0 },
      startNavigation: () => {},
      completeNavigation: () => {},
      reportReady: () => {},
      isHeavyRoute: () => false,
      disableAutoComplete: () => {},
    };
  }
  return context;
}

// Hook for pages to signal they're ready - safe version that won't crash
export function usePageReady() {
  const context = useContext(NavigationLoadingContext);
  
  const markReady = useCallback((systemName?: string) => {
    if (!context) {
      // Silently ignore if context not available
      return;
    }
    if (systemName) {
      context.reportReady(systemName);
    }
    context.completeNavigation();
  }, [context]);
  
  // Disable auto-complete for pages that manage their own readiness via callbacks
  // Call this when the page uses onReady callbacks from child components
  const disableAutoComplete = useCallback(() => {
    if (context) {
      context.disableAutoComplete();
    }
  }, [context]);

  return { markReady, disableAutoComplete };
}
