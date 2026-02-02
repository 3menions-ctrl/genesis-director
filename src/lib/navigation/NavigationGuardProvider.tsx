/**
 * NavigationGuardProvider - React context integration
 * 
 * Provides navigation coordination context to the component tree.
 * Listens for route changes and triggers cleanup automatically.
 */

import React, { createContext, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { navigationCoordinator, NavigationState } from './NavigationCoordinator';

interface NavigationGuardContextType {
  /** Current navigation state */
  state: NavigationState;
  /** Check if navigation is currently locked */
  isLocked: boolean;
  /** Force complete current navigation */
  forceComplete: () => void;
  /** Register cleanup for current route */
  registerCleanup: (cleanup: () => void) => () => void;
  /** Abort all pending operations */
  abortAll: () => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | null>(null);

interface NavigationGuardProviderProps {
  children: ReactNode;
}

export function NavigationGuardProvider({ children }: NavigationGuardProviderProps) {
  const location = useLocation();
  const prevLocationRef = useRef(location.pathname);
  const [state, setState] = React.useState<NavigationState>(navigationCoordinator.getState());

  // Subscribe to coordinator state changes
  useEffect(() => {
    return navigationCoordinator.subscribe(setState);
  }, []);

  // Detect route changes and trigger lifecycle
  useEffect(() => {
    const prevPath = prevLocationRef.current;
    const currentPath = location.pathname;

    if (prevPath !== currentPath) {
      // Route changed - complete any pending navigation
      navigationCoordinator.completeNavigation();
      
      // Trigger garbage collection hint
      navigationCoordinator.triggerGC();
      
      // Update ref
      prevLocationRef.current = currentPath;
    }
  }, [location.pathname]);

  // Force complete navigation
  const forceComplete = useCallback(() => {
    navigationCoordinator.forceUnlock();
    navigationCoordinator.completeNavigation();
  }, []);

  // Register cleanup for current route
  const registerCleanup = useCallback((cleanup: () => void) => {
    return navigationCoordinator.registerCleanup(location.pathname, cleanup);
  }, [location.pathname]);

  // Abort all pending operations
  const abortAll = useCallback(() => {
    navigationCoordinator.abortAllRequests();
    navigationCoordinator.abortAllMedia();
  }, []);

  const contextValue: NavigationGuardContextType = {
    state,
    isLocked: state.isLocked,
    forceComplete,
    registerCleanup,
    abortAll,
  };

  return (
    <NavigationGuardContext.Provider value={contextValue}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

/**
 * Use the navigation guard context.
 * Returns safe fallback if used outside provider.
 */
export function useNavigationGuardContext(): NavigationGuardContextType {
  const context = useContext(NavigationGuardContext);
  
  if (!context) {
    // Return safe fallback
    return {
      state: {
        phase: 'idle',
        fromRoute: null,
        toRoute: null,
        startTime: 0,
        isLocked: false,
      },
      isLocked: false,
      forceComplete: () => {},
      registerCleanup: () => () => {},
      abortAll: () => {},
    };
  }
  
  return context;
}
