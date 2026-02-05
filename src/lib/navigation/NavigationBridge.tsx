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

import { useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationCoordinator } from './NavigationCoordinator';
import { useNavigationLoading, usePageReady } from '@/contexts/NavigationLoadingContext';

interface NavigationBridgeProps {
  children: ReactNode;
}

/**
 * Bridge component that synchronizes NavigationCoordinator with NavigationLoadingContext.
 * Place this inside both providers in App.tsx.
 */
export function NavigationBridge({ children }: NavigationBridgeProps) {
  // NOTE: Route change handling is done by NavigationGuardProvider
  // This bridge only provides coordinated hooks for components
  // DO NOT add route change listeners here - it causes duplicate calls
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
  const location = useLocation();
  
  const signalReady = useCallback((systemName?: string) => {
    // Signal to loading context only
    // NOTE: Do NOT call navigationCoordinator.completeNavigation() here
    // NavigationGuardProvider handles completion on route change
    markReady(systemName);
  }, [markReady, location.pathname]);
  
  return { 
    signalReady, 
    disableAutoComplete,
  };
}

export default NavigationBridge;
