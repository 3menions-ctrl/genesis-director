/**
 * NavigationBridge - Connects NavigationLoadingContext with NavigationCoordinator
 * 
 * This bridge ensures both systems work together:
 * - NavigationLoadingContext: UI feedback (loading overlay, progress messages)
 * - NavigationCoordinator: Lifecycle management (locking, cleanup, abort)
 * 
 * When navigation starts, both systems are notified.
 * When navigation completes, both systems finalize.
 */

import React, { useEffect, useCallback, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationCoordinator, NavigationState } from './NavigationCoordinator';
import { useNavigationLoading, usePageReady } from '@/contexts/NavigationLoadingContext';

interface NavigationBridgeProps {
  children: ReactNode;
}

/**
 * Bridge component that synchronizes NavigationCoordinator with NavigationLoadingContext.
 * Place this inside both providers in App.tsx.
 */
export function NavigationBridge({ children }: NavigationBridgeProps) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const { startNavigation, completeNavigation, isHeavyRoute } = useNavigationLoading();

  // Listen for route changes
  useEffect(() => {
    const prevPath = prevPathRef.current;
    const currentPath = location.pathname;

    if (prevPath !== currentPath) {
      // Route changed
      
      // 1. Complete coordinator navigation (runs cleanups)
      navigationCoordinator.completeNavigation();
      
      // 2. Trigger GC
      navigationCoordinator.triggerGC();
      
      // 3. Update ref
      prevPathRef.current = currentPath;
    }
  }, [location.pathname]);

  return <>{children}</>;
}

/**
 * Hook to intercept navigation and coordinate both systems.
 * Use this instead of raw navigate() for coordinated transitions.
 */
export function useCoordinatedNavigation() {
  const { startNavigation: startLoadingUI } = useNavigationLoading();
  const location = useLocation();
  
  const startCoordinatedNavigation = useCallback(async (targetRoute: string): Promise<boolean> => {
    // 1. Try to acquire navigation lock
    const canNavigate = await navigationCoordinator.beginNavigation(
      location.pathname,
      targetRoute
    );
    
    if (!canNavigate) {
      return false;
    }
    
    // 2. Start loading UI for heavy routes
    startLoadingUI(targetRoute);
    
    return true;
  }, [location.pathname, startLoadingUI]);
  
  return {
    startNavigation: startCoordinatedNavigation,
    isLocked: navigationCoordinator.isLocked(),
  };
}

/**
 * Hook for pages to signal readiness to both systems.
 */
export function useCoordinatedReady() {
  const { markReady, disableAutoComplete } = usePageReady();
  
  const signalReady = useCallback((systemName?: string) => {
    // Signal to loading context
    markReady(systemName);
    
    // Complete navigation in coordinator
    navigationCoordinator.completeNavigation();
  }, [markReady]);
  
  return { 
    signalReady, 
    disableAutoComplete,
  };
}

export default NavigationBridge;
