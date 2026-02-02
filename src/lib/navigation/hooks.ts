/**
 * Navigation Hooks - React integration for NavigationCoordinator
 * 
 * Provides hooks for:
 * - Route cleanup registration
 * - Safe navigation with locking
 * - Navigation state subscription
 * - AbortController management
 * - Media cleanup on unmount
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigationCoordinator, NavigationState, CleanupFunction } from './NavigationCoordinator';

/**
 * Register cleanup functions that run when leaving the current route.
 * Cleanup is automatically called on navigation and unmount.
 */
export function useRouteCleanup(cleanup: CleanupFunction, deps: unknown[] = []): void {
  const location = useLocation();
  const cleanupRef = useRef(cleanup);
  
  // Update ref when cleanup changes
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup, ...deps]);

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Register cleanup with coordinator
    const unregister = navigationCoordinator.registerCleanup(
      currentPath,
      () => cleanupRef.current()
    );

    // Also run cleanup on unmount
    return () => {
      unregister();
      try {
        const result = cleanupRef.current();
        if (result instanceof Promise) {
          result.catch(() => {}); // Ignore async errors on unmount
        }
      } catch {
        // Ignore cleanup errors on unmount
      }
    };
  }, [location.pathname]);
}

/**
 * Safe navigation hook that respects navigation locking.
 * Prevents double-navigation and race conditions.
 */
export function useSafeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingNavRef = useRef<string | null>(null);

  const safeNavigate = useCallback(async (
    to: string, 
    options?: { replace?: boolean; skipLock?: boolean }
  ): Promise<boolean> => {
    // Prevent duplicate navigation
    if (pendingNavRef.current === to) {
      return false;
    }

    // Skip lock check if requested (for emergency navigation)
    if (!options?.skipLock) {
      // Check if navigation is allowed
      const canNavigate = await navigationCoordinator.beginNavigation(
        location.pathname,
        to
      );

      if (!canNavigate) {
        console.debug('[useSafeNavigation] Navigation rejected (locked)');
        return false;
      }
    }

    pendingNavRef.current = to;

    try {
      navigate(to, { replace: options?.replace });
      return true;
    } finally {
      // Clear pending after a frame to prevent immediate re-navigation
      requestAnimationFrame(() => {
        pendingNavRef.current = null;
      });
    }
  }, [navigate, location.pathname]);

  // Emergency navigation (bypasses locks)
  const emergencyNavigate = useCallback((to: string) => {
    navigationCoordinator.forceUnlock();
    navigate(to, { replace: true });
  }, [navigate]);

  return {
    navigate: safeNavigate,
    emergencyNavigate,
    isLocked: navigationCoordinator.isLocked(),
  };
}

/**
 * Subscribe to navigation state changes.
 */
export function useNavigationState(): NavigationState {
  const [state, setState] = useState<NavigationState>(navigationCoordinator.getState());

  useEffect(() => {
    return navigationCoordinator.subscribe(setState);
  }, []);

  return state;
}

/**
 * Get a managed AbortController that aborts on navigation and unmount.
 */
export function useNavigationAbort() {
  const controllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Create new controller
  const getController = useCallback((): AbortController => {
    // Abort previous if exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    controllerRef.current = navigationCoordinator.createAbortController();
    return controllerRef.current;
  }, []);

  // Get current signal
  const getSignal = useCallback((): AbortSignal => {
    if (!controllerRef.current) {
      controllerRef.current = navigationCoordinator.createAbortController();
    }
    return controllerRef.current.signal;
  }, []);

  // Abort current controller
  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  // Check if still mounted
  const isMounted = useCallback(() => isMountedRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abort();
    };
  }, [abort]);

  return {
    getController,
    getSignal,
    abort,
    isMounted,
  };
}

/**
 * Automatically pause and cleanup media elements on unmount.
 */
export function useMediaCleanup(
  mediaRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>
): void {
  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    // Register with coordinator
    navigationCoordinator.registerMediaElement(element);

    return () => {
      try {
        if (!element.paused) {
          element.pause();
        }
        // Don't clear src on unmount - let GC handle it
      } catch {
        // Element may be destroyed
      }
    };
  }, [mediaRef]);
}

/**
 * Hook that provides stable async execution with navigation awareness.
 * Automatically cancels pending operations on navigation/unmount.
 */
export function useNavigationSafeAsync() {
  const { getSignal, isMounted } = useNavigationAbort();

  const safeAsync = useCallback(<T>(
    asyncFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T | null> => {
    const signal = getSignal();
    
    return asyncFn(signal)
      .then(result => {
        if (!isMounted()) return null;
        return result;
      })
      .catch(err => {
        // Ignore abort errors
        if (err?.name === 'AbortError') return null;
        // Re-throw other errors only if mounted
        if (isMounted()) throw err;
        return null;
      });
  }, [getSignal, isMounted]);

  return safeAsync;
}

/**
 * Simplified hook that just provides mount-safe state setter
 */
export function useMountSafe() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback(<T>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: React.SetStateAction<T>
  ) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  return { safeSetState, isMounted, isMountedRef };
}
